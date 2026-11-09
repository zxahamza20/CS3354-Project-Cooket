Architecture Spike S-01

## Question

Can storing scraped recipes in Supabase let repeat searches meet QR-01 (results within 3 seconds for 95% of searches with 1 to 10 ingredients), when a live scrape takes several seconds?

Related: QR-01, risk R1 (Supabase outage), risk R6 (sites blocking the scraper), and the decision to cache scraped recipes in Supabase.

## Method

`measure.js` runs three ingredient searches. For each one it:

1. Times a live scrape (Tavily search, then Playwright extraction of every result) and saves the recipes to Supabase.
2. Times the Supabase lookup used by `findStoredRecipes()` 10 times and reports the median and maximum.
3. Records whether the lookup would answer the search without scraping (at least 3 stored recipes that use every searched ingredient).

Run it from the repository folder after setting up `backend/.env` (see `docs/Database.md`):

```
node --env-file=backend/.env spikes/S-01/measure.js
```

Environment: Supabase free tier, US region, home internet connection, Windows laptop, 6 November 2026.

## Results

| Search | Live scrape (s) | Pages found | Recipes kept | Lookup median (s) | Lookup max (s) | Cache hit |
| --- | --- | --- | --- | --- | --- | --- |
| chicken, rice, garlic | 1.95 | 10 | 1 | 0.11 | 0.21 | no |
| flour, egg, milk | 3.45 | 10 | 1 | 0.10 | 0.17 | no |
| pasta, tomatoes, garlic | 4.92 | 10 | 3 | 0.10 | 0.18 | yes |

End to end through `scrapeRecipes()` straight afterwards, "pasta, tomatoes, garlic" returned 4 recipes from Supabase in 0.24 s with no scraping, while "chicken, rice, garlic" still scraped live and took 2.07 s. Earlier first-time scrapes of the same searches took up to 5.7 s.

## Conclusion

- The Supabase lookup takes about 0.1 s (0.21 s worst case), far inside the 3 s budget, so searches answered from the database meet QR-01. This confirms the caching decision.
- Live scrapes took 2 to 5.7 s and do not reliably meet QR-01, so the cache is needed rather than optional.
- Most scraped pages are unusable: of 10 results per search, many sites return HTTP 403 and video links have no recipe data, so only 1 to 3 recipes were kept. With the rule of 3 full matches, only one of the three searches built up enough stored recipes to be answered from the database. The cache hit rate depends on scraper yield, which is recorded as a limitation in `docs/Database.md`.
