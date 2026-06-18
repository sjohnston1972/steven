# Persona Toggle — Design

**Date:** 2026-06-16
**Project:** steven-cv (Cloudflare Worker CV site, steven.clydeford.net)
**Status:** Approved design, pending implementation plan

## Problem

Steven applies for roles across distinct disciplines (security, cloud, AI, networking,
collaboration, datacentre, technical leadership). A single balanced CV/site under-sells him
for any specific role. He wants to flip the website, PDF CV, and chatbot to foreground the
discipline that matches the role he is applying for, controlled from a hidden admin panel.

Immediate driver: a Network Security Engineer role (on-prem + Azure + hybrid network security,
Zero Trust, segmentation, NGFW, SASE) — maps to a "Security" persona.

## Goals

- A global, admin-controlled "active persona" that re-emphasises the public site toward one
  discipline, with no content duplication and no visible flash.
- Re-emphasis spans: About skill tiles, Expertise cards, hero tagline/eyebrow, About intro
  copy, career timeline bullet ordering, the downloadable PDF CV, and the AI chatbot framing.
- Hidden, password-protected admin panel to switch the active persona.

## Non-goals

- Per-visitor or per-link personas (decided: single global toggle).
- Hiding or fabricating any content — re-emphasis only resurfaces existing, truthful material.
- Editing facts/credentials per persona.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Scope of change | Reorder tiles/cards + swap hero tagline/about intro + reorder career bullets + tailor PDF + tune chatbot |
| Activation model | Global toggle, stored in KV, applied to all visitors |
| Personas | Generic (default/current) + Security, Cloud, AI, Technical Lead, Collaboration, Datacentre, Networking |
| Career emphasis | Reorder bullets within each role (nothing hidden) |
| Admin access | Single password (Worker secret) + obscure URL + signed cookie |
| Chatbot | Adapts: prepend persona focus to system prompt |
| Rendering approach | A — server-side injection (HTMLRewriter) + static CSS ordering |

## Approach (chosen: A — server-side injection + CSS ordering)

The site is served as static assets. The main worker intercepts the homepage request, reads the
active persona from KV, and applies it via `HTMLRewriter` (set `data-persona` on `<body>`, swap a
few text nodes). All reordering is done with **static CSS** keyed off `data-persona` + per-element
`data-skill` attributes — zero JavaScript, zero flash. Generic sets no attribute, so every
ordering rule is inert and the page is identical to today.

Rejected alternatives:
- **B — pre-rendered variant files:** 8 near-duplicate HTML files + build step. Maintenance burden.
- **C — client-side JS reordering:** visible flash of the default layout before JS runs. Bad for
  the target audience (recruiters).

## Components

### 1. Persona data model — `worker/src/personas.js` (new, canonical)

Single source of truth, imported by the main worker, PDF worker, and chat handler.

```js
export const PERSONAS = {
  generic:       { label: "Generic", default: true },
  security:      { label: "Security",      skill: "security",      eyebrow, tagline, aboutLead, aboutBody?, chatbotFocus },
  cloud:         { label: "Cloud",         skill: "cloud",         ... },
  ai:            { label: "AI",            skill: "ai",            ... },
  techlead:      { label: "Technical Lead",skill: "techlead",      ... },
  collaboration: { label: "Collaboration", skill: "collaboration", ... },
  datacentre:    { label: "Datacentre",    skill: "datacentre",    ... },
  networking:    { label: "Networking",    skill: "networking",    ... },
};
export const DEFAULT_PERSONA = "generic";
export function resolvePersona(id) { /* validate; fallback to generic */ }
```

Copy (eyebrow/tagline/aboutLead/aboutBody/chatbotFocus) for the seven focused personas is
drafted by Claude for Steven's review. Generic retains today's wording.

Because `worker/` and `worker-pdf/` are separate wrangler projects, the PDF worker imports this
module via relative path; if the bundler cannot cross the boundary, the file is duplicated with a
"keep in sync" header comment (mirroring the existing persona.js convention).

### 2. Website rendering — `worker/src/index.js`

On a homepage request:
1. `const persona = resolvePersona(await env.CHAT_KV.get("active_persona"))`.
2. Fetch the `index.html` asset, pipe through `HTMLRewriter` to:
   - Set `<body data-persona="<id>">` (omitted for generic).
   - Replace inner content of `.hero-eyebrow`, `.hero-tagline`, `.about-lead`, and (optional)
     the first `.about-body-text` with persona copy.
3. Return the transformed response. Non-homepage assets pass through untouched.

### 3. CSS ordering — `worker/public/styles.css` + `index.html` data attributes

- Add `data-skill="<skill>"` to each `.about-stat` tile and `.skill-card`.
- Add `data-skills="<skill> <skill>"` to each career `<li>` (a bullet may map to multiple skills).
- Make `.about-stats`, `.skills-grid`, and `.timeline-list` order-aware (flex/grid with `order`).
- Add rules: `[data-persona="X"] [data-skill="X"] { order: -1 }` and
  `[data-persona="X"] .timeline-list li[data-skills~="X"] { order: -1 }` for each persona.
- Bump the `styles.css?v=` cache-buster.

### 4. PDF CV — `worker-pdf`

Imports `personas.js`, reads the same KV key, and before rendering `template.html` reorders its
skill tags/sections and swaps the summary line for the active persona. Generic → unchanged PDF.

### 5. Chatbot — `worker/src/chat.js` + `worker/src/persona.js`

Read active persona from KV; when not generic, prepend `PERSONAS[id].chatbotFocus` to
`SYSTEM_PROMPT` before the model call. All existing guardrails and rules remain unchanged.

### 6. Admin panel + auth — `worker/src/admin.js` (new)

- Route: obscure path `/manage-<random-slug>` (slug not linked anywhere public).
- `GET` without valid cookie → minimal password form.
- `POST` password → constant-time compare against Worker secret `ADMIN_PASSWORD`. On success set
  an HMAC-signed (`COOKIE_SECRET`), HttpOnly, Secure, SameSite=Strict cookie (~30 day expiry).
- Authenticated `GET` → panel with eight buttons (active highlighted), "Log out", and a
  "view site" link. Selecting a persona `POST`s and writes `active_persona` to KV.
- Reuse the existing `CHAT_LIMITER` rate-limit pattern on the password POST.
- Secrets set via `wrangler secret put ADMIN_PASSWORD` / `COOKIE_SECRET` — never committed.

## Data flow

```
Visitor → main worker → KV.get(active_persona) → HTMLRewriter(index.html) → static CSS orders → page
Visitor → /CV.pdf    → PDF worker → KV.get(active_persona) → reordered template → PDF
Visitor → /api/chat  → chat.js → KV.get(active_persona) → SYSTEM_PROMPT + focus → model
Steven  → /manage-*  → password → signed cookie → pick persona → KV.put(active_persona)
```

## Error handling

- Missing/invalid KV value → `generic` (safe default).
- KV read failure → `generic`; never block page render.
- HTMLRewriter selector miss → element simply unchanged (no crash).
- Wrong password / no cookie / tampered cookie → password form.

## Testing

- `wrangler dev`: each persona reorders tiles/cards/bullets and swaps hero/about text with **no
  flash** (network-throttled); generic layout identical to current.
- PDF reorders per persona; generic unchanged.
- Chatbot emphasis shifts per persona; guardrails hold (off-topic still refused).
- Auth: wrong password rejected; no/invalid cookie → form; logout clears; rate-limit triggers.

## Rollout

1. Implement persona module, CSS/data-attrs, HTMLRewriter, admin, PDF, chatbot.
2. `wrangler secret put ADMIN_PASSWORD` and `COOKIE_SECRET` on both workers as needed.
3. Deploy main worker + PDF worker. Verify generic == current site, then test one persona live.

## Open items for implementation

- Draft persona copy (7 personas × eyebrow/tagline/aboutLead/optional body/chatbotFocus).
- Map each career bullet to its skill tag(s).
- Decide final obscure admin slug.
- Confirm whether PDF worker can import the shared module or needs a synced duplicate.
