# steven

Personal CV site for Steven Johnston, served at **steven.clydeford.net**.

## Layout

| Path | What it is |
|------|------------|
| `worker/` | The main Cloudflare Worker (`steven-cv`): serves the site, the persona-aware chatbot (`/api/chat`), the admin panel, and PDF proxying. |
| `worker-pdf/` | The `steven-cv-pdf` service Worker that renders the CV PDF in an ATS-friendly format. |
| `docs/` | Design specs and implementation plans. |
| `*.txt` | Source snapshots of the site assets. |

## The `worker/` app

A Cloudflare Worker (`src/index.js`) with:

- **Static site** served from `public/` via the `ASSETS` binding, with persona-specific HTML rewriting.
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

## The `worker-pdf/` service

Renders `src/template.html` to a PDF with headless Chrome and caches it per persona.
The template is written for applicant tracking systems first: one linear column, no
fixed page height, standard system fonts, conventional section headings, and no
images or tables — so the extracted text comes out in reading order. `src/render.js`
reorders the skills rows in the markup rather than with CSS, keeping what the
recruiter sees and what the parser reads identical.

Bump `PDF_VERSION` in `src/index.js` (and the `?v=` on the download links in
`worker/public/index.html`) after editing the template, or the old PDF stays cached.

```bash
cd worker-pdf
npm install
npm test
npx wrangler deploy
```

Append `?debug` to the PDF URL to get a full-page PNG of the render instead.
