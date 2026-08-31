# steven

Personal CV site for Steven Johnston, served at **steven.clydeford.net**.

## Layout

| Path | What it is |
|------|------------|
| `worker/` | The main Cloudflare Worker (`steven-cv`): serves the site, the persona-aware chatbot (`/api/chat`), and the admin panel. |
| `worker-pdf/` | The `steven-cv-pdf` service Worker that used to render the CV PDF in an ATS-friendly format. **No longer wired up** — the CV is now a static asset at `worker/public/Steven_Johnston_CV.pdf`. Kept for reference; the deployed Worker has not been removed. |
| `cv/` | Source for the downloadable CV: `cv.html` plus `render.sh`, which prints it to `worker/public/Steven_Johnston_CV.pdf` with headless Chrome. |
| `docs/` | Design specs and implementation plans. |
| `*.txt` | Source snapshots of the site assets. |

## The `worker/` app

A Cloudflare Worker (`src/index.js`) with:

- **Static site** served from `public/` via the `ASSETS` binding, with persona-specific HTML rewriting. The downloadable CV (`/Steven_Johnston_CV.pdf`) is one of those assets — the same file for every persona. It is a build artifact of `cv/cv.html`: edit the HTML, run `bash cv/render.sh`, bump the `?v=` on the two download links, commit both.
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

## The `cv/` source

`cv/cv.html` is the CV. `bash cv/render.sh` prints it to
`worker/public/Steven_Johnston_CV.pdf` with headless Chrome — the same engine
that produced the original file, so metrics and page breaks match.

The layout leaves only a few mm of slack on page 1. The Technical Lead role is
`break-inside: avoid`, so adding a couple of lines above it pushes the whole
role onto page 2 and the CV becomes three pages. `render.sh` checks the page
count and refuses to replace the served PDF if it is not exactly two.

Two Chrome print behaviours are load-bearing and are commented in `cv.html`:
the page box has no top or side margin (a negative margin cannot bleed the
masthead to the trim — Chrome clips to the margin box), and page-2 white space
is in the flow, because Chrome applies one margin box to every page and ignores
`@page :first`.

## The `worker-pdf/` service (retired)

**Not wired up.** `worker/` no longer proxies `/Steven_Johnston_CV.pdf` to this
service — the CV is a static file in `worker/public/`. The code and its tests are
kept here for reference, and the deployed `steven-cv-pdf` Worker has not been
deleted from the account. Nothing below takes effect unless it is reconnected.

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
