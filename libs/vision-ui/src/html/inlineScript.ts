// Characters that can end or corrupt an inline <script> even inside a JSON
// literal: `<`/`>` can open or close a tag (`</script>`), and U+2028/U+2029
// are line terminators to older JavaScript parsers; JSON.stringify leaves
// them raw. Backslashes are deliberately left out: JSON has already escaped
// them, and escaping again would corrupt every escape sequence it wrote.
const UNSAFE_CHARS: Readonly<Record<string, string>> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

const escapeUnsafeChars = (text: string): string =>
  text.replace(/[<>\b\f\n\r\t\0\u2028\u2029]/g, (char) => UNSAFE_CHARS[char] ?? char);

// A value as a JavaScript literal that is safe to drop into inline script
// source: JSON, with every character that could break out of it escaped.
export const inlineScriptLiteral = (value: unknown): string =>
  escapeUnsafeChars(JSON.stringify(value));
