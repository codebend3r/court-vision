/**
 * SCSS linting. Replaces gale, whose prebuilt binary stopped installing.
 *
 * Everything not listed here comes from stylelint-config-standard-scss; each
 * entry below is a deliberate deviation, with the reason it exists.
 */
const config = {
  extends: ["stylelint-config-standard-scss"],
  rules: {
    // Carried over from the old gale.json.
    "no-descending-specificity": null,
    "no-duplicate-selectors": [true, { severity: "warning" }],
    "property-no-unknown": [
      true,
      {
        // CSS anchor positioning, not yet in the bundled known-property list.
        ignoreProperties: [
          "anchor-name",
          "anchor-scope",
          "position-anchor",
          "position-area",
          "position-try",
          "position-try-fallbacks",
        ],
      },
    ],

    // Gale's recommended set enabled this. The only `!important` in the repo is
    // the prefers-reduced-motion guard in globals.scss, which opts out inline.
    "declaration-no-important": true,

    // Class selectors are CSS Modules keys, read back as `styles.fooBar`, so
    // they are camelCase and not the standard config's kebab-case. Keyframe
    // names are not module keys and stay on the kebab-case default.
    "selector-class-pattern": [
      "^[a-z][a-zA-Z0-9]*$",
      {
        message:
          "Expected class selector to be camelCase (CSS Modules keys are read as `styles.fooBar`)",
      },
    ],

    // Oxfmt owns whitespace in .scss (`bun run format`). Leaving these on puts
    // the linter and the formatter in permanent disagreement over the same
    // lines, which is why stylelint deprecated its own stylistic rules.
    "at-rule-empty-line-before": null,
    "comment-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "declaration-empty-line-before": null,
    "rule-empty-line-before": null,
    "scss/double-slash-comment-empty-line-before": null,

    // A bare `//` is a paragraph break inside a comment block here, not a
    // leftover empty comment.
    "scss/comment-no-empty": null,
  },
};

export default config;
