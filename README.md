# FanStack Manager

Single-page webapp for bulk managing FanStack links (add, delete, verify) across landing pages.

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. In Cloudflare dashboard: **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick this repo.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** (leave empty)
   - **Build output directory:** `/`
4. Deploy. Every `git push` to the main branch will auto-deploy.

## Structure

- `index.html` — the UI (single file, no build step).
- `functions/api/[[path]].js` — Pages Function that proxies `/api/*` to `https://fanstack.link/api/ext/v2/*` and adds CORS. Handles browser CORS blocking of the FanStack API.

## Use

Open the deployed URL, paste your `fsl_...` API key (stored in `localStorage`), then use the panels to select a landing page and add / delete / verify links.
