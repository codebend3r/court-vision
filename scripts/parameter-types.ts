import { parse } from "@babel/parser";
import { isRecord } from "@vision/core/util/record";

type SyntaxNodesProps = { value: unknown };
const syntaxNodes = ({ value }: SyntaxNodesProps): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value.flatMap((child) => syntaxNodes({ value: child }));
  if (!isRecord(value)) return [];
  return [
    value,
    ...Object.entries(value)
      .filter(([key]) => !["loc", "comments", "tokens", "extra"].includes(key))
      .flatMap(([, child]) => syntaxNodes({ value: child })),
  ];
};

const CALLABLE_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "TSFunctionType",
  "TSMethodSignature",
  "TSDeclareFunction",
  "TSConstructorType",
]);

type InlineParameterTypesProps = { source: string };
export const inlineParameterTypes = ({ source }: InlineParameterTypesProps): number[] => {
  const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const violations = syntaxNodes({ value: ast.program })
    .filter((node) => CALLABLE_TYPES.has(String(node.type)))
    .flatMap((node) => {
      const params = node.params ?? node.parameters;
      if (!Array.isArray(params)) return [];
      return params.flatMap((param: unknown) => {
        if (!isRecord(param)) return [];
        const binding = param.type === "AssignmentPattern" ? param.left : param;
        if (!isRecord(binding) || !isRecord(binding.typeAnnotation)) return [];
        return syntaxNodes({ value: binding.typeAnnotation.typeAnnotation }).flatMap((type) => {
          if (type.type !== "TSTypeLiteral" || !isRecord(type.loc) || !isRecord(type.loc.start))
            return [];
          return typeof type.loc.start.line === "number" && typeof type.start === "number"
            ? [{ offset: type.start, line: type.loc.start.line }]
            : [];
        });
      });
    });
  return [...new Map(violations.map(({ offset, line }) => [offset, line])).values()];
};

if (import.meta.main) {
  const paths = await Array.fromAsync(new Bun.Glob("{apps,libs}/*/src/**/*.{ts,tsx}").scan());
  const violations = (
    await Promise.all(
      paths.map(async (path) =>
        inlineParameterTypes({ source: await Bun.file(path).text() }).map(
          (line) => `${path}:${line}: use a named function Props type`,
        ),
      ),
    )
  ).flat();
  violations.forEach((message) => console.error(message));
  if (violations.length > 0) process.exitCode = 1;
}
