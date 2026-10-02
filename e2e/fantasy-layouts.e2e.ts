import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { compile } from "sass";

// Real styles with isolated markup: these layout regressions do not need a
// seeded NBA database. Component behavior is covered by co-located unit tests.
const compileStyles = ({ paths }: { paths: string[] }): string =>
  paths
    .map(
      (path) =>
        compile(resolve(path), {
          importers: [
            {
              findFileUrl: (url) =>
                url.startsWith("@/") ? pathToFileURL(resolve("src", url.slice(2))) : null,
            },
          ],
        }).css,
    )
    .join("\n");

const listCss = compileStyles({
  paths: [
    "src/styles/globals.scss",
    "src/components/FantasyChartList/FantasyChartList.module.scss",
    "src/components/FantasyValueCharts/FantasyValueCharts.module.scss",
  ],
});
const panelsCss = compileStyles({
  paths: [
    "src/styles/globals.scss",
    "src/components/PlayerFantasyChart/PlayerFantasyChart.module.scss",
  ],
});

const sizes = [320, 375, 640, 1280].flatMap((width) =>
  [16, 32].map((fontSize) => ({ width, fontSize })),
);
const categories = ["PTS", "REB", "AST", "STL", "BLK", "3PM", "TOV", "FG%", "FT%"];

[false, true].forEach((signedIn) => {
  test(`fantasy chart rows fit narrow and enlarged-text layouts (signed in: ${signedIn})`, async ({
    page,
  }) => {
    const star = signedIn ? '<span class="starCell"><button type="button">★</button></span>' : "";
    const bands = categories.map((label) => `<span title="${label}">${label}</span>`).join("");
    await sizes.reduce(async (previous, { width, fontSize }) => {
      await previous;
      await test.step(`${width}px, ${fontSize}px root text`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(`
          <style>
            ${listCss}
            html { font-size: ${fontSize}px; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 1rem; }
            .avatar { width: 2.25rem; height: 2.25rem; }
          </style>
          <section class="root">
            <header class="caption">
              <p class="hint">Each category's Z and G, on one scale shared by every row on this page.</p>
              <ul class="legend"><li class="legendItem">Z-Score</li><li class="legendItem">G-Score</li></ul>
            </header>
            <div class="wrapper" data-star="${signedIn}">
              <div class="head">
                ${star}<span class="rank">#</span><span class="playerHeading">Player</span>
                <button class="sortButton" data-method="z">Z-Score</button>
                <button class="sortButton" data-method="g">G-Score</button>
                <span class="bands"><span class="bandLabels" style="grid-template-columns: repeat(9, minmax(0, 1fr))">${bands}</span></span>
              </div>
              <ol class="list"><li class="row">
                ${star}<span class="rank">100</span>
                <span class="player"><span class="avatar"></span><span class="identity">
                  <a href="#player" class="name">Shai Gilgeous-Alexander</a><span class="meta">OKC · G</span>
                </span></span>
                <span class="readout" data-method="z">+123.4</span>
                <span class="readout" data-method="g">+123.4</span>
                <div class="chart"><svg width="100%" height="48"></svg></div>
              </li></ol>
            </div>
          </section>
        `);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await expect(page.locator(".name")).toBeVisible();
        await expect(page.locator(".readout")).toHaveCount(2);
      });
    }, Promise.resolve());
  });
});

test("player fantasy panels fit their container at narrow widths and enlarged text", async ({
  page,
}) => {
  await sizes.reduce(async (previous, { width, fontSize }) => {
    await previous;
    await test.step(`${width}px, ${fontSize}px root text`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`
        <style>
          ${panelsCss}
          html { font-size: ${fontSize}px; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 1rem; }
        </style>
        <section class="root"><div class="panels">
          <section class="panel"><h3 class="panelTitle">Category breakdown</h3><svg width="100%" height="320"></svg></section>
          <section class="panel"><h3 class="panelTitle">Rolling value</h3><svg width="100%" height="320"></svg></section>
        </div></section>
      `);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await expect(page.getByRole("heading", { name: "Category breakdown" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Rolling value" })).toBeVisible();
    });
  }, Promise.resolve());
});
