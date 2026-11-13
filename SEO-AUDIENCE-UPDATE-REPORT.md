# Final audience-led SEO update — 13 November 2026

## Scope
Updated the existing bilingual site package `abdullah-law-site-seo-targeted-22-pages.zip`. No new service pages, audience-specific duplicate pages, new legal practice areas, or changes to the approved visual identity were introduced.

## Audience and search-intent implementation
- Preserved the 11 Arabic and 11 English canonical service pages.
- Added one service-specific FAQ to each of the 22 pages addressing a real cross-border or international-client question relevant to that service.
- The Arabic FAQs address clients in Egypt and Egyptians/clients abroad, including Gulf-based clients, without stuffing country names into every page.
- The English FAQs address foreign nationals, overseas clients and international investors in natural English.
- FAQ answers distinguish an initial remote review from formal representation, powers of attorney, original documents and personal attendance. They do not promise that every procedure can be completed remotely.
- Existing page titles, descriptions, H1s, service scopes, legal methodology, design and contact flows were retained unless already optimized in the input SEO package.
- Internal service navigation and canonical URL architecture were preserved.

## English-language rendering correction
On English service pages, elements carrying paired `data-ar` and `data-en` values now use their English text as the initial HTML text where the source had Arabic. This improves language consistency for initial rendering and crawlers while retaining the Arabic data attributes for the language switcher. This was a source-level language default correction, not a redesign.

## Search targeting
The accompanying CSV maps each of the 22 service pages to a primary phrase, related phrase cluster, market scope and search intent. These are strategic target phrases based on service relevance and search intent, not measured search-volume rankings.

## Measurement status — important
No search-volume figures, keyword difficulty scores, CPC values or country-level ranking positions have been fabricated. These require Google Keyword Planner / Google Ads historical metrics, Search Console and/or a connected keyword research provider. Google notes that average monthly searches depend on location, language, search network and selected date range, and are rounded estimates:
- https://support.google.com/google-ads/answer/3022575
- https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics

Google's guidance emphasizes helpful, people-first content and using language searchers use in prominent page locations:
- https://developers.google.com/search/docs/essentials
- https://developers.google.com/search/docs/appearance/title-link
- https://developers.google.com/search/docs/specialty/international/localized-versions

## Validation performed on the package
- Confirmed 22 canonical service pages are present.
- Added a relevant FAQ item to each of the 22 pages.
- Checked page titles, meta descriptions, H1 presence, canonical links and paired language alternates.
- Checked that the site archive remains readable and its internal service links point to existing canonical service pages.
- No deployment to Vercel or GitHub was performed.
- No live browser, Lighthouse, Search Console or live keyword-volume verification is claimed.

## Before production deployment
1. Review the preview on desktop and mobile in Arabic and English.
2. Confirm the English language switcher still changes to Arabic correctly after the initial HTML default correction.
3. Connect Google Search Console and export performance by query, page and country.
4. Run Keyword Planner historical metrics separately for Egypt, Saudi Arabia, UAE, Kuwait, Qatar, Oman, Bahrain and each selected foreign country, using the correct language.
5. Only after those measurements, adjust target phrases where the data supports a change.
