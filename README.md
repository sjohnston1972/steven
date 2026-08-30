# steven

Personal CV site for Steven Johnston, served at **steven.clydeford.net**.

## Layout

| Path | What it is |
|------|------------|
| `worker/` | The main Cloudflare Worker (`steven-cv`): serves the site, the persona-aware chatbot (`/api/chat`), and the admin panel. |
| `worker-pdf/` | The `steven-cv-pdf` service Worker that used to render the CV PDF. **No longer wired up** — the CV is now a static asset at `worker/public/Steven_Johnston_CV.pdf`. Kept for reference; the deployed Worker has not been removed. |
| `docs/` | Design specs and implementation plans. |
| `*.txt` | Source snapshots of the site assets. |

## The `worker/` app

A Cloudflare Worker (`src/index.js`) with:

- **Static site** served from `public/` via the `ASSETS` binding, with persona-specific HTML rewriting. The downloadable CV (`/Steven_Johnston_CV.pdf`) is one of those assets — the same file for every persona.
- **Chatbot** at `/api/chat` — streams responses from Workers AI (`AI` binding), rate-limited per IP, scoped strictly to Steven's professional background.
- **Admin panel** at an unlinked path for switching the active persona (stored in `CHAT_KV`).
- **Chat logging** — each turn is appended to a shared `chat-logs` D1 database (`DB` binding). One row per `(site, ip)`; transcripts accumulate server-side via SQLite `json_insert`. See `src/chat.js` (`logChat` / `accumulateReply`).

### Develop

```bash
cd worker
npm install
npm test        # vitest (unit + workers pool)
npm run dev      # wrangler dev
npm run deploy   # wrangler deploy
```

### Secrets

Bindings are declared in `worker/wrangler.jsonc`. Secrets (`ADMIN_PASSWORD`, `COOKIE_SECRET`, etc.) and deploy credentials are kept in a local `.env` (gitignored) and as Worker secrets — never committed.
