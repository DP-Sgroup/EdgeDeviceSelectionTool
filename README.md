# Industrial Edge Device Selector

Enter what an install needs (connectors, tags, sample rates, WinCC Unified, apps, network, security) and the tool tells you which
hardware fits, with a PASS/FAIL breakdown for every device considered.

Two pages: **Requirements** and **Recommendation**. It is a static site - no server, no build step, no dependencies. All calculation
happens in the browser; catalog data lives in `data/*.json`.

## Install types

| Install type | Devices checked |
|---|---|
| **DPS package (Core / Pro)** - the default | **DPS Core** = SIMATIC IPC BX-21A (4-core Atom x6413E, 16 GB RAM, 256 GB SSD) and **DPS Pro** = SIMATIC IPC BX-39A (6-core Xeon W-11555MLE, 16 GB RAM, 512 GB SSD). Core is chosen when it passes; Pro when only Pro passes. |
| **General install** | Every Siemens Industrial Edge device in `data/devices.json`; the cheapest that passes every check wins. |

A device belongs to a DPS package through its `dpsPackage` field in `data/devices.json` (`"DPS Core"`, `"DPS Pro"` or `null`).
If neither package fits, the recommendation page offers a one-click switch to a general install.

## Run it locally

The page loads its data with `fetch`, so it must be served over http (double-clicking `index.html` will not work):

```bash
python -m http.server 8080
```

then open <http://localhost:8080>. Tests: <http://localhost:8080/tests/>, or `node tests/run-node.mjs` if Node 18+ is installed.

## Where things are

| Path | Purpose |
|---|---|
| `index.html`, `css/style.css` | page shell and styling |
| `js/app.js` | UI (install type, forms, live refresh, recommendation page, share link, print) |
| `js/calc.js` | **all sizing logic** - pure functions, ported 1:1 from the Excel workbook |
| `data/devices.json` | device catalog (cores, per-core performance index, RAM/storage available to apps, ports, TPM, DPS package, ...) |
| `data/connectors.json` | per-connector CPU/RAM cost and Siemens-documented limits |
| `data/apps.json` | per-app CPU/RAM/storage cost |
| `data/assumptions.json` | headroom, platform overhead, WinCC Unified, memory-limit reservation factor, ... |
| `tests/` | regression scenarios checked against the Excel workbook |
| `.github/workflows/pages.yml` | runs the tests, then publishes to GitHub Pages |

## How the sizing works

* CPU is in **Atom x6413E core-equivalents** (one BX-21A core = 1.0). A device's capacity is `cores x perfIndex`, where `perfIndex` is the
  PassMark single-thread score divided by 1,456 - so a 6-core Xeon W-11555MLE counts as ~11 BX-21A cores.
* **RAM** pass/fail uses actual app memory x the *memory-limit reservation factor* (2.5), because Industrial Edge's Memory Limit Check sums
  each app's reserved memory against ~90% of device RAM.
* CPU and storage get 20% headroom (`data/assumptions.json` -> `headroom`).
* Connector limits (max connections, max tags/s) come from the Siemens manuals and raise warnings.

## Evidence tags

Every catalog value carries a `confidence` of `siemens` (Siemens documentation), `field` (measured on client installs, anonymised as
Client 1 = BX-21A site, Client 2 = BX-39A site) or `estimate`. The recommendation page reports how much of the requirement rests on
estimates - replace estimates with measurements to improve it.

## Updating the data

1. Edit the relevant file in `data/`. Keep the `basis` text and the `confidence` tag up to date. **Do not add client or site names** - this
   repository is public; use "Client N". A test checks that every measured entry cites a "Client N" site.
2. Run the tests. If a number was *meant* to change, update the expected value in `tests/scenarios.js` in the same commit.
3. Commit to `main`; the workflow redeploys the site.

## Publishing on GitHub Pages

1. Create a repository and upload the contents of this folder to its root (keep the `.github` folder - it holds the deploy workflow).
2. In the repository: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
3. Open the **Actions** tab; the "Deploy to GitHub Pages" run tests the code and publishes it. The site URL appears on the run and under
   Settings -> Pages (normally `https://<your-user>.github.io/<repo-name>/`).

The site is public. `noindex` asks search engines not to list it but is not access control.

## Caveats

Siemens publishes almost no CPU sizing, so CPU figures rest on measurements from two client sites plus one Siemens test. Device
specifications follow the Siemens Industrial Edge devices page. This is an engineering aid, not a Siemens tool - always confirm the final
configuration, app compatibility (Industrial Edge Hub) and licensing with Siemens or your distributor.
