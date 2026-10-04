import { inlineScriptLiteral } from "#ui/html/inlineScript";
import { THEMES } from "#ui/theme/themes";

// Stamps `data-theme` on <html> before first paint: the stored choice when it
// is still a known theme, otherwise the system light/dark preference. Built
// from the registry, so a theme added there is accepted here with no second
// list to keep in sync. Render it in <head>.
export const themeInitSource = (): string =>
  `(function(){try{var t=localStorage.getItem("theme");var ok=${inlineScriptLiteral(THEMES)};if(ok.indexOf(t)===-1){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export const ThemeInitScript = () => (
  <script dangerouslySetInnerHTML={{ __html: themeInitSource() }} />
);
