# NIRMAN web

Two pages, no build step:

- `index.html` — public landing page
- `app.html` — the authenticated dashboard (loads the four scripts in `js/`)

## Run

Open `index.html` directly, or serve the folder so relative paths behave
exactly as they will in production:

```bash
cd web
python3 -m http.server 5173     # or: npx serve .
```

Then visit <http://localhost:5173>.

## Where things live

| File | What it holds |
|---|---|
| `css/styles.css` | Design tokens and every dashboard component style |
| `css/landing.css` | Landing page only |
| `js/core.js` | Utilities, Lucide icon paths, reference data, settings, **the risk engine** |
| `js/data.js` | Synthetic dataset generation, alert rules, users, app state |
| `js/views.js` | Charts and one render function per screen |
| `js/app.js` | Modal, event delegation, router, boot |

Load order matters — the files share globals rather than using ES modules, so
they work from `file://` without a server or bundler.

## Switching to the live API

The dashboard currently generates its dataset in the browser so it runs with no
backend. To point it at the Express API instead, replace the body of `initData()`
in `js/data.js` with `fetch` calls to `/api/v1/projects` and `/api/v1/alerts`, and
replace `handle('login')` in `js/app.js` with a `POST /api/v1/auth/login` that
stores the returned JWT. Every render function reads from `S`, so nothing else
needs to change.
