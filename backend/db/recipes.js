import { supabase } from "./client.js";
import { rankRecipes } from "../scraper/score.js";

const MAX_STORED_RESULTS = 50;
// With fewer stored recipes than this using every searched ingredient, search live instead.
const MIN_FULL_MATCHES = 3;

function toRow(recipe) {
  return {
    url: recipe.url,
    title: recipe.title || "Untitled recipe",
    ingredients: recipe.ingredients,
    ingredients_search: recipe.ingredients.join(" ").toLowerCase(),
    steps: recipe.steps ?? [],
    text: recipe.text ?? "",
  };
}

// Drops a plural ending so "tomatoes" also finds "tomato". This only narrows the candidates;
// rankRecipes() decides what actually matches.
function stem(ingredient) {
  const word = ingredient.toLowerCase().trim();
  if (word.endsWith("ies")) return word.slice(0, -3);
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

// Quoted so ingredients containing commas, dots or parentheses can't break the filter syntax.
function containsFilter(ingredient) {
  const pattern = `%${stem(ingredient)}%`.replace(/["\\]/g, "\\$&");
  return `ingredients_search.ilike."${pattern}"`;
}

// Saves scraped recipes, replacing any stored recipe with the same url.
// Never throws: a failed save shouldn't stop the user getting their scraped results.
export async function saveRecipes(recipes) {
  // Postgres rejects an upsert that touches the same url twice in one batch.
  const rows = [...new Map(recipes.map((recipe) => [recipe.url, toRow(recipe)])).values()];
  if (!supabase || rows.length === 0) return;

  const { error } = await supabase.from("recipes").upsert(rows, { onConflict: "url" });
  if (error) {
    console.error(`Saving recipes failed: ${error.message}`);
  }
}

// Returns stored recipes containing at least one ingredient, shaped like extractRecipe() output.
// Returns null when there are too few good matches or the database isn't configured or
// can't be reached, so the caller falls back to scraping.
export async function findStoredRecipes(ingredients) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("recipes")
    .select("url, title, ingredients, steps, text")
    .or(ingredients.map(containsFilter).join(","))
    .limit(MAX_STORED_RESULTS);

  if (error) {
    console.error(`Stored recipe lookup failed, scraping instead: ${error.message}`);
    return null;
  }

  // Same matching as the ranking, so a "full match" here is a 100% match score in the results.
  const ranked = rankRecipes(data, { ingredients, mode: "flexible" });
  const fullMatches = ranked.filter((recipe) => recipe.matchScore === 100).length;
  return fullMatches >= MIN_FULL_MATCHES ? data : null;
}
