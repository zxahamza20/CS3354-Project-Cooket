import { Router } from "express";
import { chromium } from "playwright";
import { buildQuery, searchRecipes } from "../scraper/search.js";
import { extractRecipe } from "../scraper/extract.js";
import { rankRecipes } from "../scraper/score.js";
import { findStoredRecipes, saveRecipes } from "../db/recipes.js";

const MODES = ["flexible", "strict"];

const router = Router();

export async function scrapeRecipes(params) {
  // Use stored recipes when the database has enough good matches it skips the slow live scrape
  const stored = await findStoredRecipes(params.ingredients);
  if (stored) return rankRecipes(stored, params);

  const urls = await searchRecipes(buildQuery(params.ingredients));

  const browser = await chromium.launch();
  try {
    const pages = await Promise.all(
      urls.map((url) => extractRecipe(browser, url)),
    );
    const recipes = pages.filter(Boolean);
    // Saved before ranking b/c rankRecipes() strips the text field used for breaking ties
    await saveRecipes(recipes);
    return rankRecipes(recipes, params);
  } finally {
    await browser.close();
  }
}

router.get("/", async (req, res) => {
  const { flavor, foodtype, texture, mode = "flexible" } = req.query;

  const ingredients = String(req.query.ingredients ?? "")
    .replace(/^\s*\[|\]\s*$/g, "") // Allow ingredients=[egg, bacon]
    .split(",")
    .map((ingredient) => ingredient.trim())
    .filter((ingredient) => ingredient);
  console.log(ingredients);
  if (ingredients.length === 0) {
    return res.status(400).json({ error: "ingredients is required" });
  }
  if (!MODES.includes(mode)) {
    return res.status(400).json({ error: "mode must be strict or flexible" });
  }

  try {
    const recipes = await scrapeRecipes({
      ingredients,
      flavor,
      foodtype,
      texture,
      mode,
    });
    res.json({ count: recipes.length, recipes });
  } catch (error) {
    console.error("Scrape failed:", error);
    res.status(502).json({ error: "Recipe search failed, please try again" });
  }
});

export default router;
