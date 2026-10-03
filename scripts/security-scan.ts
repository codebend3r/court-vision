/**
 * Static security gate for CI.
 *
 * Encodes the invariants the `cv-security` review agent looks for that no
 * off-the-shelf tool checks: the server/client secret boundary, unguarded
 * server actions, and raw Prisma interpolation. Runs offline, no API key.
 *
 * Usage: bun run scripts/security-scan.ts
 * Exits 1 with a report if any invariant is violated.
 */

import { Glob } from "bun";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

type Violation = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly detail: string;
  readonly fix: string;
};

type SourceFile = {
  readonly path: string;
  readonly text: string;
  readonly lines: readonly string[];
  readonly isClient: boolean;
  readonly isServerAction: boolean;
};

const ROOT = resolve(import.meta.dir, "..");

/**
 * A workspace project with source to scan: every app and lib. Its package.json
 * `imports` (lib-private `#name/` aliases) and `exports` (public `@vision/*`
 * entry points) are read so the import graph can follow edges across package
 * boundaries; otherwise a secret reached through a lib would be invisible.
 */
type Project = {
  readonly root: string;
  readonly src: string;
  readonly name: string;
  readonly imports: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, string>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Only plain string targets are source files; conditional objects (e.g. a
// types-only entry) carry no runtime code for the scan to follow.
const stringEntries = (value: unknown): Readonly<Record<string, string>> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};

const readProject = (manifest: string): Project => {
  const root = dirname(manifest);
  const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  const pkg = isRecord(parsed) ? parsed : {};
  return {
    root,
    src: join(root, "src"),
    name: typeof pkg.name === "string" ? pkg.name : "",
    imports: stringEntries(pkg.imports),
    exports: stringEntries(pkg.exports),
  };
};

const PROJECTS: readonly Project[] = [
  ...new Glob("{apps,libs}/*/package.json").scanSync({ cwd: ROOT, absolute: true }),
].map(readProject);

/** Repo-relative path, the form violations and the baseline are keyed by. */
const repoPath = (path: string): string => relative(ROOT, path);

/** Env vars that must never reach the browser bundle. */
const SERVER_ONLY_ENV = ["BALLDONTLIE_API_KEY", "DATABASE_URL", "DIRECT_URL"] as const;

/** Substrings that make a NEXT_PUBLIC_ name a likely secret leak. */
const SECRET_NAME_HINTS = ["SERVICE_ROLE", "SECRET", "PRIVATE", "PASSWORD", "SERVICE_KEY"] as const;

/**
 * Helpers that establish an authenticated session, read from the session
 * module's own exports so the list cannot drift out of sync with the code.
 */
const sessionGuards = (): readonly string[] =>
  PROJECTS.map((project) => join(project.src, "lib", "auth", "session.ts"))
    .filter((path) => existsSync(path))
    .flatMap((path) =>
      [
        ...readFileSync(path, "utf8").matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(\w+)/g),
      ].map((match) => match[1] ?? ""),
    );

const SESSION_GUARDS = sessionGuards();

const lineOf = ({ text, index }: { text: string; index: number }): number =>
  text.slice(0, index).split("\n").length;

const readSource = (path: string): SourceFile => {
  const text = readFileSync(path, "utf8");
  const head = text.slice(0, 400);
  return {
    path,
    text,
    lines: text.split("\n"),
    isClient: /^\s*["']use client["']/m.test(head),
    isServerAction: /^\s*["']use server["']/m.test(head),
  };
};

const collectSources = (): readonly SourceFile[] =>
  PROJECTS.flatMap((project) =>
    existsSync(project.src)
      ? [...new Glob("**/*.{ts,tsx}").scanSync({ cwd: project.src, absolute: true })]
      : [],
  )
    .filter(
      (path) =>
        !/\.(test|spec)\.tsx?$/.test(path) &&
        !path.includes("/testing/") &&
        !path.includes("/libs/vision-testing/"),
    )
    .map(readSource);

/** The project whose directory holds `file` (projects never nest). */
const projectOf = (file: string): Project | undefined =>
  PROJECTS.find((project) => file.startsWith(`${project.root}/`));

/**
 * Match `specifier` against a package.json `imports`/`exports` map the way
 * Node does: an exact key wins; otherwise, among `*` patterns that fit, the
 * longest prefix wins, then the longest key. Every `*` in the target takes
 * the matched part.
 */
const matchSubpath = ({
  map,
  specifier,
  root,
}: {
  map: Readonly<Record<string, string>>;
  specifier: string;
  root: string;
}): string | null => {
  const exact = map[specifier];
  if (exact !== undefined) return resolve(root, exact);
  const best = Object.entries(map)
    .flatMap(([key, target]) => {
      const star = key.indexOf("*");
      if (star === -1) return [];
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);
      const fits =
        specifier.startsWith(prefix) &&
        specifier.endsWith(suffix) &&
        specifier.length >= prefix.length + suffix.length;
      if (!fits) return [];
      const matched = specifier.slice(prefix.length, specifier.length - suffix.length);
      return [{ prefix, key, target: target.replaceAll("*", matched) }];
    })
    .sort((a, b) => b.prefix.length - a.prefix.length || b.key.length - a.key.length)[0];
  return best === undefined ? null : resolve(root, best.target);
};

/** Resolve an import specifier to its target path base, or null if external. */
const specifierBase = ({
  specifier,
  fromFile,
}: {
  specifier: string;
  fromFile: string;
}): string | null => {
  const owner = projectOf(fromFile);
  if (specifier.startsWith(".")) return resolve(dirname(fromFile), specifier);
  if (specifier.startsWith("@/"))
    return owner === undefined ? null : join(owner.src, specifier.slice(2));
  if (specifier.startsWith("#")) {
    return owner === undefined
      ? null
      : matchSubpath({ map: owner.imports, specifier, root: owner.root });
  }
  const target = PROJECTS.find(
    (project) =>
      project.name !== "" &&
      (specifier === project.name || specifier.startsWith(`${project.name}/`)),
  );
  if (target === undefined) return null;
  const subpath = specifier === target.name ? "." : `.${specifier.slice(target.name.length)}`;
  return matchSubpath({ map: target.exports, specifier: subpath, root: target.root });
};

/** Resolve an import specifier to an absolute file path, or null if external. */
const resolveImport = ({
  specifier,
  fromFile,
  known,
}: {
  specifier: string;
  fromFile: string;
  known: ReadonlySet<string>;
}): string | null => {
  const base = specifierBase({ specifier, fromFile });

  if (base === null) return null;

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];

  return candidates.find((candidate) => known.has(candidate)) ?? null;
};

const importsOf = ({
  file,
  known,
}: {
  file: SourceFile;
  known: ReadonlySet<string>;
}): readonly string[] =>
  [...file.text.matchAll(/(?:from|import)\s*["']([^"']+)["']/g)]
    .map((match) => resolveImport({ specifier: match[1] ?? "", fromFile: file.path, known }))
    .filter((path): path is string => path !== null);

/**
 * Rule 1: a module that reads a server-only secret must not be reachable from
 * a "use client" module. Traversal stops at "use server" files, which Next.js
 * compiles to RPC stubs rather than inlining into the client bundle.
 */
const checkSecretBoundary = (sources: readonly SourceFile[]): readonly Violation[] => {
  const byPath = new Map(sources.map((file) => [file.path, file]));
  const known = new Set(byPath.keys());

  const reachable = sources
    .filter((file) => file.isClient)
    .reduce<ReadonlySet<string>>((seen, entry) => {
      const walk = (path: string, acc: ReadonlySet<string>): ReadonlySet<string> => {
        const file = byPath.get(path);
        if (file === undefined || acc.has(path) || file.isServerAction) return acc;
        const next = new Set(acc).add(path);
        return importsOf({ file, known }).reduce<ReadonlySet<string>>(
          (inner, child) => walk(child, inner),
          next,
        );
      };
      return importsOf({ file: entry, known }).reduce<ReadonlySet<string>>(
        (inner, child) => walk(child, inner),
        seen,
      );
    }, new Set<string>());

  return sources.flatMap((file) =>
    SERVER_ONLY_ENV.flatMap((name) => {
      const index = file.text.indexOf(`process.env.${name}`);
      if (index === -1) return [];

      const rel = repoPath(file.path);
      const guarded = /import\s+["']server-only["']/.test(file.text);

      if (reachable.has(file.path)) {
        return [
          {
            rule: "secret-reaches-client",
            file: rel,
            line: lineOf({ text: file.text, index }),
            detail: `reads ${name} and is transitively imported by a "use client" module, so it is a candidate for the browser bundle`,
            fix: `add \`import "server-only"\` at the top of ${rel}, then break the client import chain`,
          },
        ];
      }

      return guarded
        ? []
        : [
            {
              rule: "secret-module-unguarded",
              file: rel,
              line: lineOf({ text: file.text, index }),
              detail: `reads ${name} but has no \`server-only\` guard, so nothing prevents a future client import from bundling it`,
              fix: `add \`import "server-only"\` as the first import in ${rel}`,
            },
          ];
    }),
  );
};

/** Rule 2: no NEXT_PUBLIC_ variable may be named like a secret. */
const checkPublicEnvNames = (sources: readonly SourceFile[]): readonly Violation[] =>
  sources.flatMap((file) =>
    [...file.text.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)]
      .filter((match) => SECRET_NAME_HINTS.some((hint) => (match[1] ?? "").includes(hint)))
      .map((match) => ({
        rule: "public-env-looks-secret",
        file: repoPath(file.path),
        line: lineOf({ text: file.text, index: match.index ?? 0 }),
        detail: `${match[1]} is exposed to the browser by the NEXT_PUBLIC_ prefix but is named like a secret`,
        fix: "drop the NEXT_PUBLIC_ prefix and read it server-side only",
      })),
  );

// A tagged-template placeholder holding a bare identifier (`${gameLimit}`).
// Prisma sends those as bound parameters, never as SQL text.
const BOUND_PLACEHOLDER = /^\$\{\s*[A-Za-z_$][\w$]*\s*\}$/;

/**
 * Rule 3: raw Prisma SQL must be parameterized. Allowed: a tagged
 * `$queryRaw`/`$executeRaw` template whose placeholders are bare identifiers,
 * which Prisma binds as parameters. Flagged: the Unsafe variants, the call
 * form, any placeholder holding an expression (a call, a nested template, a
 * concatenation), and `Prisma.raw`, the one way a bound identifier could
 * smuggle SQL text in as a pre-built fragment.
 */
const checkRawPrisma = (sources: readonly SourceFile[]): readonly Violation[] =>
  sources.flatMap((file) => {
    const violation = ({ index, detail }: { index: number; detail: string }): Violation => ({
      rule: "raw-prisma-interpolation",
      file: repoPath(file.path),
      line: lineOf({ text: file.text, index }),
      detail,
      fix: "use a tagged $queryRaw template with bare-identifier placeholders, or the typed client",
    });
    const rawQueries = [
      ...file.text.matchAll(/\$(?:query|execute)Raw(Unsafe)?\s*(?:`([^`]*)`|\()/g),
    ]
      .filter(
        (match) =>
          match[1] !== undefined ||
          (match[0] ?? "").endsWith("(") ||
          [...(match[2] ?? "").matchAll(/\$\{[^}]*\}/g)].some(
            (placeholder) => !BOUND_PLACEHOLDER.test(placeholder[0] ?? ""),
          ),
      )
      .map((match) =>
        violation({
          index: match.index ?? 0,
          detail: "raw query uses the Unsafe variant, the call form, or an expression placeholder",
        }),
      );
    const rawFragments = [...file.text.matchAll(/Prisma\.raw\s*\(/g)].map((match) =>
      violation({
        index: match.index ?? 0,
        detail: "Prisma.raw splices unparameterized SQL text into a query",
      }),
    );
    return [...rawQueries, ...rawFragments];
  });

/**
 * Rule 4: every exported server action must consult the session before it
 * returns. Heuristic and deliberately loose: it flags an action with no
 * session helper anywhere in the file.
 */
const checkServerActionAuth = (sources: readonly SourceFile[]): readonly Violation[] =>
  sources
    .filter((file) => file.isServerAction)
    .filter((file) => !SESSION_GUARDS.some((guard) => file.text.includes(guard)))
    .flatMap((file) => {
      const match = /export\s+(?:async\s+)?(?:function|const)\s+(\w+)/.exec(file.text);
      return match === null
        ? []
        : [
            {
              rule: "server-action-unauthenticated",
              file: repoPath(file.path),
              line: lineOf({ text: file.text, index: match.index }),
              detail: `"use server" module exports ${match[1]} but calls no session helper (${SESSION_GUARDS.join(", ")})`,
              fix: "resolve the user from the session and fail closed before any write",
            },
          ];
    });

/**
 * Violations that already existed when this gate was introduced. Each entry is
 * a deliberate, reviewed decision, not a snooze: see baseline.json for why.
 * Anything not listed here fails the build.
 */
type BaselineEntry = { readonly rule: string; readonly file: string; readonly reason: string };

const isBaselineEntry = (value: unknown): value is BaselineEntry =>
  typeof value === "object" &&
  value !== null &&
  "rule" in value &&
  typeof value.rule === "string" &&
  "file" in value &&
  typeof value.file === "string" &&
  "reason" in value &&
  typeof value.reason === "string";

const baseline = (): readonly BaselineEntry[] => {
  const path = join(import.meta.dir, "security-scan-baseline.json");
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null || !("known" in parsed)) return [];
    const known = parsed.known;
    return Array.isArray(known) ? known.filter(isBaselineEntry) : [];
  } catch {
    return [];
  }
};

const KNOWN = baseline();
const isKnown = (violation: Violation): boolean =>
  KNOWN.some((entry) => entry.rule === violation.rule && entry.file === violation.file);

const sources = collectSources();

const found = [
  ...checkSecretBoundary(sources),
  ...checkPublicEnvNames(sources),
  ...checkRawPrisma(sources),
  ...checkServerActionAuth(sources),
];

const violations = found.filter((violation) => !isKnown(violation));
const accepted = found.filter(isKnown);

accepted.forEach((violation) => {
  const entry = KNOWN.find((k) => k.rule === violation.rule && k.file === violation.file);
  console.log(
    `  known  [${violation.rule}] ${violation.file}:${violation.line} — ${entry?.reason}`,
  );
});

// A baseline entry that no longer matches anything means the issue was fixed.
// Say so loudly: a stale allowlist is how a gate quietly stops gating.
const stale = KNOWN.filter(
  (entry) => !found.some((v) => v.rule === entry.rule && v.file === entry.file),
);
stale.forEach((entry) => {
  console.log(
    `  stale  [${entry.rule}] ${entry.file} no longer matches — drop it from the baseline`,
  );
});

if (violations.length === 0) {
  console.log(
    `security-scan: ${sources.length} files, no new violations (${accepted.length} baselined)`,
  );
  process.exit(0);
}

console.error(`\nsecurity-scan: ${violations.length} new violation(s)\n`);
violations.forEach((violation) => {
  console.error(`  [${violation.rule}] ${violation.file}:${violation.line}`);
  console.error(`    ${violation.detail}`);
  console.error(`    fix: ${violation.fix}\n`);
});
process.exit(1);
