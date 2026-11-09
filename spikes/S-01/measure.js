// Spike S-01: compares a live scrape against a Supabase lookup for the same searches.
// Run from the repository folder: node --env-file=backend/.env spikes/S-01/measure.js
import { createRequire } from "node:module";
import { buildQuery, searchRecipes } from "../../backend/scraper/search.js";
import { extractRecipe } from "../../backend/scraper/extract.js";
import { findStoredRecipes, saveRecipes } from "../../backend/db/recipes.js";
import { supabase } from "../../backend/db/client.js";

// Playwright is only installed in backend/node_modules.
const { chromium } = createRequire(new URL("../../backend/package.json", import.meta.url))("playwright");

const SEARCHES = [
  ["chicken", "rice", "garlic"],
  ["flour", "egg", "milk"],
  ["pasta", "tomatoes", "garlic"],
];
const LOOKUP_RUNS = 10;

const seconds = (ms) => (ms / 1000).toFixed(2);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function timeLiveScrape(ingredients) {
  const start = performance.now();
  const urls = await searchRecipes(buildQuery(ingredients));
  const browser = await chromium.launch();
  try {
    const pages = await Promise.all(urls.map((url) => extractRecipe(browser, url)));
    const recipes = pages.filter(Boolean);
    const ms = performance.now() - start;
    await saveRecipes(recipes);
    return { ms, pagesFound: urls.length, recipesKept: recipes.length };
  } finally {
    await browser.close();
  }
}

async function timeLookups(ingredients) {
  const times = [];
  let cacheHit = false;
  for (let run = 0; run < LOOKUP_RUNS; run++) {
    const start = performance.now();
    cacheHit = (await findStoredRecipes(ingredients)) !== null;
    times.push(performance.now() - start);
  }
  return { medianMs: median(times), maxMs: Math.max(...times), cacheHit };
}

if (!supabase) {
  throw new Error("Supabase is not configured, add SUPABASE_URL and SUPABASE_SECRET_KEY to backend/.env");
}

console.log("| Search | Live scrape (s) | Pages found | Recipes kept | Lookup median (s) | Lookup max (s) | Cache hit |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const ingredients of SEARCHES) {
  const live = await timeLiveScrape(ingredients);
  const lookup = await timeLookups(ingredients);
  console.log(
    `| ${ingredients.join(", ")} | ${seconds(live.ms)} | ${live.pagesFound} | ${live.recipesKept} | ` +
      `${seconds(lookup.medianMs)} | ${seconds(lookup.maxMs)} | ${lookup.cacheHit ? "yes" : "no"} |`,
  );
}
