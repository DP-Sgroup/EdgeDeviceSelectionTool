# DPS Product Configurator

A standalone, dependency-free wizard for DPS Edge, Cyber and Net part numbers, based on DPS_IMS_STAND0001 v1.0. Open `product-configurator/` on the same static host as the existing device sizing tool. The sizing tool remains separate.

## Run and test

From the repository root:

```sh
python3 -m http.server 8080
# Open http://localhost:8080/product-configurator/
node --test product-configurator/tests/engine.test.mjs
node tests/run-node.mjs
# Optional browser smoke test (requires Playwright and Chromium):
# node product-configurator/tests/browser-smoke.cjs
```

No install or build step. Node 20+ for tests, a modern browser for the wizard. Existing GitHub Pages hosting serves this folder after merging the branch; the new check workflow validates pull requests without deploying them.

## Included

- Five-step wizard: family/series/vendor, enclosure/power, physical connectivity, controlled subsystem/options, and BoM/cost review.
- Live code validation, copy, configurable batch quantity and draft BoM CSV export.
- Siemens IOT2050 `6ES7647-0BW00-1YA2` mapped to SI Light (commercial display: Lite).
- All three released I/O variants, including separate base and expansion lines for variant B.
- Component catalogue additions, quantity lines and optional GBP cost entry. Blank means unknown; zero means a confirmed zero cost. Summary always labels the known subtotal as partial.
- Local browser draft persistence and downloadable JSON with configuration, catalogue/prices, revision identifiers and calculated BoM. JSON import validates controlled identities and recalculates results.
- Price date per component, GBP costs excluding VAT, integer minor-unit line calculations and CSV formula protection.

## Files and architecture

| File | Responsibility |
| --- | --- |
| `catalog.mjs` | Versioned standard lookups, stable component IDs and known manufacturer parts |
| `engine.mjs` | Pure validation, SKU generation, BoM expansion, batch costing, export and import |
| `app.mjs` | Wizard, browser-local editing and persistence |
| `index.html`, `style.css` | Responsive UI; no external assets or network dependencies |
| `tests/engine.test.mjs` | Standard, cost and import/export regression tests |
| `docs/standard-notes.md` | Source evidence, ambiguities and release decisions |

## Extending this into unit production

Keep SKU definitions separate from assembly recipes and supplier prices. Next stage: approved revisioned assembly recipes keyed by capability selections; engineering-reviewed compatibility constraints; nesting and explosion of Cyber/Net assemblies; supplier quotes with currency/effective dates; labour, commissioning and overhead; controlled release and build-pack generation; persistent shared storage and access control. Stable component IDs and configuration snapshots provide the starting point.

Current drafts explicitly include unresolved enclosure, power, networking, firewall, mounting, wiring, protection, software/licensing, labour and test requirements. Manual component additions do not close those requirements. No configuration is marked production-ready. Core/Pro/IO and other vendors support SKU generation but need released hardware recipes.

## Pricing and hosting

No supplier costs or confidential project data are committed. Prices entered in the UI stay in local browser storage and downloaded files; they are not sent to GitHub. This repository and its Pages host are public: do not commit real commercial pricing to them. Shared controlled prices require an authenticated backend, not static JSON on a public host. Clearing browser data removes drafts; export to JSON to preserve or move them.

See [standard notes](docs/standard-notes.md) for Light/Lite, XX enclosure and count-X clarifications.
