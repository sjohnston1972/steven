# Persona Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-controlled "active persona" that re-emphasises the CV website, PDF, and chatbot toward one discipline (Security, Cloud, AI, Technical Lead, Collaboration, Datacentre, Networking) or a Generic default.

**Architecture:** A single global persona id is stored in Cloudflare KV (`CHAT_KV`, key `active_persona`). The main worker reads it per request, sets `<body data-persona="X">` and swaps hero/about copy via `HTMLRewriter`; static CSS keyed on `data-persona` + per-element `data-skill` floats the relevant tiles/cards/career bullets up (zero JS, zero flash). The PDF worker receives the persona via an internal header and applies the same CSS-order trick in headless Chrome. The chatbot prepends a persona focus line to its system prompt. A hidden, password-protected admin route writes the KV value.

**Tech Stack:** Cloudflare Workers, Workers KV, HTMLRewriter, Web Crypto (HMAC cookie), `@cloudflare/vitest-pool-workers` for tests, vanilla HTML/CSS, Puppeteer (existing PDF worker).

**Spec:** `docs/superpowers/specs/2026-06-16-persona-toggle-design.md`

---

## File Structure

**Main worker (`worker/`):**
- Create: `worker/package.json` — dev deps + test scripts (none currently exists)
- Create: `worker/vitest.config.js` — vitest workers pool config
- Create: `worker/src/personas.js` — canonical persona data + `resolvePersona`
- Create: `worker/src/auth.js` — HMAC cookie sign/verify, constant-time compare
- Create: `worker/src/render.js` — `applyPersonaToHtml(response, persona)` via HTMLRewriter
- Create: `worker/src/admin.js` — admin route handler (login form, panel, set persona, logout)
- Create: `worker/test/personas.test.js`, `auth.test.js`, `render.test.js`, `admin.test.js`
- Modify: `worker/src/index.js` — route admin path, transform homepage, forward persona to PDF
- Modify: `worker/src/chat.js` — prepend persona focus to system prompt
- Modify: `worker/public/index.html` — add `data-skill`/`data-skills` attributes, bump css version
- Modify: `worker/public/styles.css` — make containers order-aware + per-persona order rules
- Modify: `worker/wrangler.jsonc` — no binding change needed (CHAT_KV already bound); add `.dev.vars` note

**PDF worker (`worker-pdf/`):**
- Modify: `worker-pdf/src/template.html` — add `data-skill` attributes, CSS order rules, copy tokens
- Modify: `worker-pdf/src/index.js` — read `X-Persona` header, inject persona, persona in cache key

**Secrets (both workers as needed):** `ADMIN_PASSWORD`, `COOKIE_SECRET` via `wrangler secret put`.

---

## Persona → element mapping (reference for Tasks 2, 8, 9)

Persona ids and the `data-skill` they float up:

| Persona id | Label | About tile floated | Expertise card floated |
|---|---|---|---|
| `generic` | Generic | (none — default order) | (none) |
| `security` | Security | Security | Security |
| `cloud` | Cloud | Cloud | Cloud & Hybrid |
| `ai` | AI | AI | Automation & Dev |
| `techlead` | Technical Lead | Technical Lead | (none) |
| `collaboration` | Collaboration | Collaboration | Collaboration |
| `datacentre` | Datacentre | Datacentre | Datacentre |
| `networking` | Networking | (none) | Infrastructure |

(Cross-coverage is intentional: every non-generic persona floats at least one element across the two sections.)

---

## Task 1: Test harness for the main worker

**Files:**
- Create: `worker/package.json`
- Create: `worker/vitest.config.js`

- [ ] **Step 1: Create `worker/package.json`**

```json
{
  "name": "steven-cv-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "vitest": "~2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `worker/vitest.config.js`**

```js
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
    test: {
        poolOptions: {
            workers: {
                wrangler: { configPath: "./wrangler.jsonc" },
            },
        },
    },
});
```

- [ ] **Step 3: Install dependencies**

Run: `cd worker && npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Verify the runner works with an empty run**

Run: `cd worker && npx vitest run`
Expected: "No test files found" (exit 0 or the no-tests message) — confirms vitest + pool resolve.

- [ ] **Step 5: Commit**

```bash
git add worker/package.json worker/vitest.config.js
git commit -m "chore: add vitest workers test harness to main worker"
```

(If the directory is not a git repo, skip every commit step in this plan.)

---

## Task 2: Persona data model

**Files:**
- Create: `worker/src/personas.js`
- Test: `worker/test/personas.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/personas.test.js
import { describe, it, expect } from "vitest";
import { PERSONAS, DEFAULT_PERSONA, resolvePersona } from "../src/personas.js";

describe("personas", () => {
    it("has generic as the default", () => {
        expect(DEFAULT_PERSONA).toBe("generic");
        expect(PERSONAS.generic.default).toBe(true);
    });

    it("defines all eight personas", () => {
        expect(Object.keys(PERSONAS).sort()).toEqual(
            ["ai", "cloud", "collaboration", "datacentre", "generic", "networking", "security", "techlead"].sort()
        );
    });

    it("every non-generic persona has copy + a skill", () => {
        for (const [id, p] of Object.entries(PERSONAS)) {
            if (id === "generic") continue;
            expect(p.skill, id).toBeTruthy();
            expect(p.eyebrow, id).toBeTruthy();
            expect(p.tagline, id).toBeTruthy();
            expect(p.aboutLead, id).toBeTruthy();
            expect(p.chatbotFocus, id).toBeTruthy();
        }
    });

    it("resolvePersona returns generic for unknown/empty input", () => {
        expect(resolvePersona(null).id).toBe("generic");
        expect(resolvePersona("nope").id).toBe("generic");
        expect(resolvePersona("security").id).toBe("security");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/personas.test.js`
Expected: FAIL — cannot find module `../src/personas.js`.

- [ ] **Step 3: Create `worker/src/personas.js`**

```js
// Canonical persona definitions. Imported by index.js, chat.js, render.js.
// Generic = current balanced view (overrides nothing). Each focused persona
// floats its `skill` element up and swaps the hero eyebrow/tagline + about lead.
export const PERSONAS = {
    generic: { id: "generic", label: "Generic", default: true },

    security: {
        id: "security", label: "Security", skill: "security",
        eyebrow: "Network Security Engineer &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Securing enterprise networks across on-premise, cloud, and hybrid — Zero Trust, segmentation, and Azure network security.",
        aboutLead: "I design and secure enterprise network infrastructure across on-premise, cloud, and hybrid environments — next-generation firewalls, segmentation, Zero Trust access, and Azure network security. I take secure connectivity from first principles through to production for enterprise and public sector clients, including critical national infrastructure.",
        chatbotFocus: "Foreground Steven's network security and Azure security work: next-generation firewalls (Palo Alto, Cisco, Fortinet), Cisco ISE and ZTNA, SASE, network segmentation, and secure hybrid connectivity. Frame answers around securing enterprise networks.",
    },

    cloud: {
        id: "cloud", label: "Cloud", skill: "cloud",
        eyebrow: "Cloud Network Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Designing secure, resilient Azure networking — Virtual WAN, ExpressRoute, transit hubs, and hybrid connectivity at enterprise scale.",
        aboutLead: "I design and deliver secure Azure cloud networking for enterprise and public sector clients — Virtual WAN, ExpressRoute, transit-hub architectures, NVA firewalls, and resilient hybrid connectivity — taken from design through to production.",
        chatbotFocus: "Foreground Steven's Azure and hybrid cloud networking: Azure Virtual WAN, ExpressRoute, transit hubs, NVA firewalls, multi-region design, and secure hybrid connectivity.",
    },

    ai: {
        id: "ai", label: "AI", skill: "ai",
        eyebrow: "AI Automation Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Bringing agentic AI into infrastructure operations — automation platforms that cut manual effort and accelerate incident response.",
        aboutLead: "For the past two years I've focused on bringing agentic AI into infrastructure operations — designing and deploying automation platforms that integrate LLM-based tooling with enterprise infrastructure to cut manual effort, speed up delivery, and accelerate incident response.",
        chatbotFocus: "Foreground Steven's agentic AI and automation work: LLM-based tooling, AI ops platforms, agentic network automation, and incident automation built on secure Azure infrastructure.",
    },

    techlead: {
        id: "techlead", label: "Technical Lead", skill: "techlead",
        eyebrow: "Technical Lead &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Leading the architecture and delivery of complex enterprise infrastructure — setting standards and mentoring teams from concept to production.",
        aboutLead: "I lead the technical design and delivery of infrastructure programmes for enterprise and public sector clients — owning architecture, setting technical standards across concurrent programmes, mentoring a team of engineers, and seeing complex multi-vendor deployments through to production.",
        chatbotFocus: "Foreground Steven's technical leadership: leading a team of 7 consultants, programme delivery, solution architecture, setting technical standards, mentoring, and resource planning.",
    },

    collaboration: {
        id: "collaboration", label: "Collaboration", skill: "collaboration",
        eyebrow: "Collaboration Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Designing enterprise voice and collaboration — Cisco CUCM, Webex, Microsoft Teams, SIP/CUBE, and unified communications at scale.",
        aboutLead: "I design and deliver enterprise collaboration and voice solutions — Cisco CUCM and Webex, large-scale Microsoft Teams migrations, SIP and CUBE integration, and secure unified communications for enterprise and public sector clients.",
        chatbotFocus: "Foreground Steven's collaboration and voice work: Cisco CUCM and Webex, Microsoft Teams migrations, SIP and CUBE integration, enterprise voice, and secure video conferencing.",
    },

    datacentre: {
        id: "datacentre", label: "Datacentre", skill: "datacentre",
        eyebrow: "Datacentre Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Designing and transforming datacentres — Cisco Nexus and UCS, VMware and Nutanix, multi-DC builds and migrations.",
        aboutLead: "I design, build, and transform datacentre infrastructure — Cisco Nexus switching and UCS compute, VMware and Nutanix — delivering multi-datacentre builds and migrations for enterprise and public sector clients.",
        chatbotFocus: "Foreground Steven's datacentre work: Cisco Nexus and UCS, VMware and Nutanix, DC design and architecture, multi-datacentre transformation, and large datacentre builds.",
    },

    networking: {
        id: "networking", label: "Networking", skill: "networking",
        eyebrow: "Network Architect &nbsp;·&nbsp; Glasgow, Scotland",
        tagline: "Architecting enterprise networks — BGP/OSPF, SD-WAN, campus LAN/WAN, and resilient multi-site connectivity from design to production.",
        aboutLead: "I architect and deliver enterprise networks — BGP and OSPF routing, SD-WAN, campus LAN/WAN, and resilient multi-site connectivity — taking complex multi-vendor deployments from design through to production for enterprise and public sector clients.",
        chatbotFocus: "Foreground Steven's core networking: network architecture and design, BGP and OSPF, WAN and SD-WAN, campus LAN/WAN, and resilient multi-site connectivity.",
    },
};

export const DEFAULT_PERSONA = "generic";

export function resolvePersona(id) {
    if (id && Object.prototype.hasOwnProperty.call(PERSONAS, id)) return PERSONAS[id];
    return PERSONAS[DEFAULT_PERSONA];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/personas.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/personas.js worker/test/personas.test.js
git commit -m "feat: add canonical persona data model"
```

---

## Task 2 follow-up: keep persona facts truthful

Persona copy only re-emphasises existing, true CV content. Do not introduce claims absent from `worker/src/persona.js` / `index.html`. The drafts above are derived from existing material; Steven reviews them in Task 10.

---

## Task 3: HMAC cookie auth utilities

**Files:**
- Create: `worker/src/auth.js`
- Test: `worker/test/auth.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/auth.test.js
import { describe, it, expect } from "vitest";
import { signSession, verifySession, timingSafeEqual } from "../src/auth.js";

const SECRET = "test-cookie-secret-value";

describe("auth", () => {
    it("timingSafeEqual compares correctly", () => {
        expect(timingSafeEqual("abc", "abc")).toBe(true);
        expect(timingSafeEqual("abc", "abd")).toBe(false);
        expect(timingSafeEqual("abc", "abcd")).toBe(false);
    });

    it("round-trips a signed session", async () => {
        const token = await signSession(SECRET, 60_000);
        const ok = await verifySession(SECRET, token);
        expect(ok).toBe(true);
    });

    it("rejects a tampered token", async () => {
        const token = await signSession(SECRET, 60_000);
        const tampered = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a");
        expect(await verifySession(SECRET, tampered)).toBe(false);
    });

    it("rejects an expired token", async () => {
        const token = await signSession(SECRET, -1000); // already expired
        expect(await verifySession(SECRET, token)).toBe(false);
    });

    it("rejects garbage", async () => {
        expect(await verifySession(SECRET, "")).toBe(false);
        expect(await verifySession(SECRET, "nonsense")).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/auth.test.js`
Expected: FAIL — cannot find module `../src/auth.js`.

- [ ] **Step 3: Create `worker/src/auth.js`**

```js
// Signed-session helpers for the admin panel. Token = "<expiryMs>.<hmac>",
// HMAC-SHA256 over the expiry string using COOKIE_SECRET. No DB needed.

function b64urlFromBytes(bytes) {
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, message) {
    const key = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    return b64urlFromBytes(new Uint8Array(sig));
}

export function timingSafeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

// ttlMs > 0 for a valid token; negative ttl produces an already-expired token (tests).
export async function signSession(secret, ttlMs) {
    const expiry = String(Date.now() + ttlMs);
    const sig = await hmac(secret, expiry);
    return `${expiry}.${sig}`;
}

export async function verifySession(secret, token) {
    if (!token || typeof token !== "string" || !token.includes(".")) return false;
    const idx = token.lastIndexOf(".");
    const expiry = token.slice(0, idx);
    const sig = token.slice(idx + 1);
    if (!/^\d+$/.test(expiry)) return false;
    const expected = await hmac(secret, expiry);
    if (!timingSafeEqual(sig, expected)) return false;
    return Number(expiry) > Date.now();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/auth.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/auth.js worker/test/auth.test.js
git commit -m "feat: add HMAC signed-session helpers for admin auth"
```

---

## Task 4: Apply persona to HTML (HTMLRewriter)

**Files:**
- Create: `worker/src/render.js`
- Test: `worker/test/render.test.js`

- [ ] **Step 1: Write the failing test**

```js
// worker/test/render.test.js
import { describe, it, expect } from "vitest";
import { applyPersonaToHtml } from "../src/render.js";
import { PERSONAS } from "../src/personas.js";

const SAMPLE = `<!DOCTYPE html><html><body class="light">
<p class="hero-eyebrow">OLD EYEBROW</p>
<p class="hero-tagline">OLD TAGLINE</p>
<p class="about-lead">OLD LEAD</p>
</body></html>`;

function res(html) {
    return new Response(html, { headers: { "Content-Type": "text/html" } });
}

describe("applyPersonaToHtml", () => {
    it("leaves markup unchanged for generic (no data-persona)", async () => {
        const out = await applyPersonaToHtml(res(SAMPLE), PERSONAS.generic).text();
        expect(out).not.toContain("data-persona");
        expect(out).toContain("OLD TAGLINE");
    });

    it("sets data-persona and swaps copy for a focused persona", async () => {
        const out = await applyPersonaToHtml(res(SAMPLE), PERSONAS.security).text();
        expect(out).toContain('data-persona="security"');
        expect(out).toContain(PERSONAS.security.tagline);
        expect(out).toContain(PERSONAS.security.eyebrow.replace(/&nbsp;/g, " ") || PERSONAS.security.tagline);
        expect(out).not.toContain("OLD TAGLINE");
        expect(out).not.toContain("OLD LEAD");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/render.test.js`
Expected: FAIL — cannot find module `../src/render.js`.

- [ ] **Step 3: Create `worker/src/render.js`**

```js
// Transforms the homepage HTML for the active persona using HTMLRewriter.
// Generic returns the response untouched. Focused personas set
// <body data-persona="id"> and swap the hero eyebrow/tagline + about lead copy.

class SetAttr {
    constructor(name, value) { this.name = name; this.value = value; }
    element(el) { el.setAttribute(this.name, this.value); }
}

class SetInner {
    constructor(html) { this.html = html; }
    element(el) { el.setInnerContent(this.html, { html: true }); }
}

export function applyPersonaToHtml(response, persona) {
    if (!persona || persona.id === "generic") return response;
    return new HTMLRewriter()
        .on("body", new SetAttr("data-persona", persona.id))
        .on(".hero-eyebrow", new SetInner(persona.eyebrow))
        .on(".hero-tagline", new SetInner(persona.tagline))
        .on(".about-lead", new SetInner(persona.aboutLead))
        .transform(response);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/render.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/render.js worker/test/render.test.js
git commit -m "feat: add HTMLRewriter persona transform for homepage"
```

---

## Task 5: Admin route handler

**Files:**
- Create: `worker/src/admin.js`
- Test: `worker/test/admin.test.js`

The handler owns the obscure admin path. It needs `env.CHAT_KV`, `env.ADMIN_PASSWORD`, `env.COOKIE_SECRET`. The route path string lives in `index.js` (Task 6); the handler is path-agnostic and is told its own base path so it can build form actions.

- [ ] **Step 1: Write the failing test**

```js
// worker/test/admin.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { handleAdmin, ADMIN_COOKIE } from "../src/admin.js";
import { signSession } from "../src/auth.js";

const BASE = "/manage-test";
const PW = "s3cret";
const CS = "cookie-secret";
const testEnv = () => ({ CHAT_KV: env.CHAT_KV, ADMIN_PASSWORD: PW, COOKIE_SECRET: CS });

function get(cookie) {
    return new Request("https://x" + BASE, { headers: cookie ? { Cookie: `${ADMIN_COOKIE}=${cookie}` } : {} });
}
function post(form, cookie) {
    const body = new URLSearchParams(form).toString();
    return new Request("https://x" + BASE, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookie ? { Cookie: `${ADMIN_COOKIE}=${cookie}` } : {}) },
        body,
    });
}

describe("handleAdmin", () => {
    beforeEach(async () => { await env.CHAT_KV.delete("active_persona"); });

    it("shows the password form when unauthenticated", async () => {
        const r = await handleAdmin(get(), testEnv(), BASE);
        const html = await r.text();
        expect(r.status).toBe(200);
        expect(html).toContain("type=\"password\"");
        expect(html).not.toContain("Active persona");
    });

    it("rejects a wrong password", async () => {
        const r = await handleAdmin(post({ action: "login", password: "wrong" }), testEnv(), BASE);
        expect([401, 403]).toContain(r.status);
        expect(r.headers.get("Set-Cookie")).toBeNull();
    });

    it("accepts the right password and sets a cookie", async () => {
        const r = await handleAdmin(post({ action: "login", password: PW }), testEnv(), BASE);
        expect(r.status).toBe(303);
        expect(r.headers.get("Set-Cookie")).toContain(ADMIN_COOKIE);
        expect(r.headers.get("Set-Cookie")).toContain("HttpOnly");
    });

    it("shows the panel when authenticated", async () => {
        const token = await signSession(CS, 60_000);
        const r = await handleAdmin(get(token), testEnv(), BASE);
        const html = await r.text();
        expect(html).toContain("Active persona");
        expect(html).toContain("Security");
    });

    it("sets the active persona in KV when authenticated", async () => {
        const token = await signSession(CS, 60_000);
        const r = await handleAdmin(post({ action: "set", persona: "security" }, token), testEnv(), BASE);
        expect(r.status).toBe(303);
        expect(await env.CHAT_KV.get("active_persona")).toBe("security");
    });

    it("ignores an invalid persona id", async () => {
        const token = await signSession(CS, 60_000);
        await handleAdmin(post({ action: "set", persona: "bogus" }, token), testEnv(), BASE);
        expect(await env.CHAT_KV.get("active_persona")).toBeNull();
    });

    it("blocks set when unauthenticated", async () => {
        const r = await handleAdmin(post({ action: "set", persona: "security" }), testEnv(), BASE);
        expect([401, 403]).toContain(r.status);
        expect(await env.CHAT_KV.get("active_persona")).toBeNull();
    });

    it("logs out by clearing the cookie", async () => {
        const token = await signSession(CS, 60_000);
        const r = await handleAdmin(post({ action: "logout" }, token), testEnv(), BASE);
        expect(r.headers.get("Set-Cookie")).toContain("Max-Age=0");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd worker && npx vitest run test/admin.test.js`
Expected: FAIL — cannot find module `../src/admin.js`.

- [ ] **Step 3: Create `worker/src/admin.js`**

```js
import { PERSONAS } from "./personas.js";
import { signSession, verifySession, timingSafeEqual } from "./auth.js";

export const ADMIN_COOKIE = "sj_admin";
const KV_KEY = "active_persona";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function readCookie(request, name) {
    const header = request.headers.get("Cookie") || "";
    for (const part of header.split(";")) {
        const [k, ...v] = part.trim().split("=");
        if (k === name) return v.join("=");
    }
    return null;
}

function htmlResponse(body, status = 200, extraHeaders = {}) {
    return new Response(body, {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
    });
}

function page(inner) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>Manage</title>
<style>
body{font-family:system-ui,sans-serif;background:#14110f;color:#efe9e2;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.box{width:min(420px,92vw);background:#1f1b18;border:1px solid #3a322c;border-radius:14px;padding:28px}
h1{font-size:18px;margin:0 0 16px}
input,button{font:inherit}
input[type=password]{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #4a4039;background:#14110f;color:#efe9e2;margin-bottom:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 0 4px}
button{cursor:pointer;padding:10px;border-radius:8px;border:1px solid #4a4039;background:#2a2420;color:#efe9e2}
button.active{outline:2px solid #c08a4a;border-color:#c08a4a}
button.primary{background:#c08a4a;border-color:#c08a4a;color:#14110f;width:100%}
form.inline{margin:0}
.row{display:flex;justify-content:space-between;align-items:center;margin-top:16px}
a{color:#c08a4a}
</style></head><body><div class="box">${inner}</div></body></html>`;
}

function loginForm(base, error = "") {
    return page(`<h1>Manage</h1>
${error ? `<p style="color:#e08a8a">${error}</p>` : ""}
<form class="inline" method="POST" action="${base}">
<input type="hidden" name="action" value="login">
<input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
<button class="primary" type="submit">Unlock</button>
</form>`);
}

function panel(base, active) {
    const buttons = Object.values(PERSONAS).map((p) =>
        `<form class="inline" method="POST" action="${base}">
<input type="hidden" name="action" value="set">
<input type="hidden" name="persona" value="${p.id}">
<button type="submit" class="${p.id === active ? "active" : ""}">${p.label}</button>
</form>`).join("");
    return page(`<h1>Active persona</h1>
<p>Currently: <strong>${PERSONAS[active] ? PERSONAS[active].label : active}</strong></p>
<div class="grid">${buttons}</div>
<div class="row">
<a href="/" target="_blank" rel="noopener">View site ↗</a>
<form class="inline" method="POST" action="${base}"><input type="hidden" name="action" value="logout"><button type="submit">Log out</button></form>
</div>`);
}

function sessionCookie(token, ttlSeconds) {
    return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttlSeconds}`;
}

export async function handleAdmin(request, env, base) {
    const secret = env.COOKIE_SECRET || "";
    const authed = await verifySession(secret, readCookie(request, ADMIN_COOKIE));

    if (request.method === "GET") {
        return authed
            ? htmlResponse(panel(base, (await env.CHAT_KV.get(KV_KEY)) || "generic"))
            : htmlResponse(loginForm(base));
    }

    if (request.method === "POST") {
        const form = await request.formData();
        const action = form.get("action");

        if (action === "login") {
            const password = form.get("password") || "";
            const expected = env.ADMIN_PASSWORD || "";
            if (!expected || !timingSafeEqual(password, expected)) {
                return htmlResponse(loginForm(base, "Incorrect password."), 401);
            }
            const token = await signSession(secret, SESSION_TTL_MS);
            return new Response(null, {
                status: 303,
                headers: { Location: base, "Set-Cookie": sessionCookie(token, SESSION_TTL_MS / 1000) },
            });
        }

        if (!authed) return htmlResponse(loginForm(base, "Session expired."), 403);

        if (action === "set") {
            const persona = form.get("persona");
            if (persona && Object.prototype.hasOwnProperty.call(PERSONAS, persona)) {
                await env.CHAT_KV.put(KV_KEY, persona);
            }
            return new Response(null, { status: 303, headers: { Location: base } });
        }

        if (action === "logout") {
            return new Response(null, {
                status: 303,
                headers: { Location: base, "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` },
            });
        }
    }

    return htmlResponse(loginForm(base), 405);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd worker && npx vitest run test/admin.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/admin.js worker/test/admin.test.js
git commit -m "feat: add password-protected admin panel handler"
```

---

## Task 6: Wire routing into the main worker

**Files:**
- Modify: `worker/src/index.js`

Choose the obscure admin slug now and use it consistently. This plan uses `/manage-7fq2x9` — replace with your own random slug in Step 1.

- [ ] **Step 1: Replace `worker/src/index.js` with the wired version**

```js
import { handleChat } from "./chat.js";
import { handleAdmin } from "./admin.js";
import { applyPersonaToHtml } from "./render.js";
import { resolvePersona } from "./personas.js";

// Obscure, unlinked admin path. Change this slug to your own random value.
const ADMIN_PATH = "/manage-7fq2x9";

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === ADMIN_PATH) {
            return handleAdmin(request, env, ADMIN_PATH);
        }

        // Resolve the active persona once (safe default on any KV failure).
        let personaId = "generic";
        try {
            personaId = (await env.CHAT_KV.get("active_persona")) || "generic";
        } catch (_) { /* keep generic */ }
        const persona = resolvePersona(personaId);

        if (url.pathname === "/Steven_Johnston_CV.pdf") {
            // Forward the active persona to the PDF service via an internal header.
            const pdfReq = new Request(request, { headers: request.headers });
            pdfReq.headers.set("X-Persona", persona.id);
            return env.PDF.fetch(pdfReq);
        }

        if (url.pathname === "/api/chat") {
            return handleChat(request, env, ctx, persona);
        }

        const assetResponse = await env.ASSETS.fetch(request);

        // Only transform the HTML document responses; pass assets through.
        const isHtml = (assetResponse.headers.get("Content-Type") || "").includes("text/html");
        if (isHtml) {
            return applyPersonaToHtml(assetResponse, persona);
        }
        return assetResponse;
    },
};
```

Note: `new Request(request, { headers })` then `.set` works because the new Request's headers are mutable. If the runtime rejects mutation, build headers first: `const h = new Headers(request.headers); h.set("X-Persona", persona.id); const pdfReq = new Request(request, { headers: h });`.

- [ ] **Step 2: Manual smoke test with wrangler dev**

Run: `cd worker && npx wrangler dev`
Then in another terminal: `curl -s http://localhost:8787/ | grep -c "data-persona"`
Expected: `0` (KV empty → generic → no attribute). Ctrl-C to stop.

- [ ] **Step 3: Set a persona via KV and re-check**

With `wrangler dev` running: `npx wrangler kv key put --binding=CHAT_KV active_persona security --local`
(If your wrangler version differs, set it via the admin panel in Task 11 instead.)
Then: `curl -s http://localhost:8787/ | grep -o 'data-persona="[a-z]*"'`
Expected: `data-persona="security"`. Reset: `npx wrangler kv key delete --binding=CHAT_KV active_persona --local`.

- [ ] **Step 4: Run the full worker test suite**

Run: `cd worker && npx vitest run`
Expected: PASS — personas, auth, render, admin all green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.js
git commit -m "feat: wire persona routing, admin path, and homepage transform"
```

---

## Task 7: Chatbot persona focus

**Files:**
- Modify: `worker/src/chat.js`

`handleChat` now receives the resolved `persona` (4th arg from Task 6). It prepends `persona.chatbotFocus` to the system prompt for non-generic personas. Make the arg optional so existing call sites/tests don't break.

- [ ] **Step 1: Inspect the current system-prompt assembly**

Run: `cd worker && grep -n "SYSTEM_PROMPT\|export async function handleChat\|messages" src/chat.js`
Expected: shows where `SYSTEM_PROMPT` is imported and where the system message is placed into the model request.

- [ ] **Step 2: Update the signature and prompt assembly**

In `worker/src/chat.js`, change the function signature to accept the persona and build an effective system prompt. Replace the existing `export async function handleChat(request, env, ctx) {` line with:

```js
export async function handleChat(request, env, ctx, persona) {
```

Then, immediately before the system prompt is used to build the model messages, insert:

```js
    // Tune emphasis for the active persona without changing any facts/guardrails.
    const focus = persona && persona.id !== "generic" && persona.chatbotFocus
        ? `\n\n## Current focus\n${persona.chatbotFocus} Keep all rules above; only adjust which experience you lead with.`
        : "";
    const systemPrompt = SYSTEM_PROMPT + focus;
```

Then use `systemPrompt` (instead of `SYSTEM_PROMPT`) wherever the system role message is constructed for the model call.

- [ ] **Step 3: Write a focused test**

```js
// worker/test/chat-focus.test.js
import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../src/persona.js";
import { PERSONAS } from "../src/personas.js";

// Pure assembly check mirroring chat.js logic (keep in sync with chat.js).
function buildSystemPrompt(persona) {
    const focus = persona && persona.id !== "generic" && persona.chatbotFocus
        ? `\n\n## Current focus\n${persona.chatbotFocus} Keep all rules above; only adjust which experience you lead with.`
        : "";
    return SYSTEM_PROMPT + focus;
}

describe("chatbot persona focus", () => {
    it("is unchanged for generic", () => {
        expect(buildSystemPrompt(PERSONAS.generic)).toBe(SYSTEM_PROMPT);
    });
    it("appends focus for a persona", () => {
        const out = buildSystemPrompt(PERSONAS.security);
        expect(out.startsWith(SYSTEM_PROMPT)).toBe(true);
        expect(out).toContain(PERSONAS.security.chatbotFocus);
    });
});
```

- [ ] **Step 4: Run the test**

Run: `cd worker && npx vitest run test/chat-focus.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add worker/src/chat.js worker/test/chat-focus.test.js
git commit -m "feat: tune chatbot emphasis to the active persona"
```

---

## Task 8: HTML data attributes + CSS ordering (website)

**Files:**
- Modify: `worker/public/index.html`
- Modify: `worker/public/styles.css`

- [ ] **Step 1: Tag the About tiles**

In `worker/public/index.html`, add a `data-skill` attribute to each `.about-stat` opening tag, matching the tile by its `.about-stat-value` text:

- Cloud tile → `<div class="about-stat" data-skill="cloud">`
- Security tile → `<div class="about-stat" data-skill="security">`
- AI tile → `<div class="about-stat" data-skill="ai">`
- Technical Lead tile → `<div class="about-stat" data-skill="techlead">`
- Collaboration tile → `<div class="about-stat" data-skill="collaboration">`
- Datacentre tile → `<div class="about-stat" data-skill="datacentre">`

- [ ] **Step 2: Tag the Expertise cards**

Add `data-skill` to each `.skill-card` opening tag, matched by its `.skill-card-title`:

- Infrastructure → `<div class="skill-card reveal" data-skill="networking">`
- Security → `<div class="skill-card reveal" data-skill="security">`
- Cloud & Hybrid → `<div class="skill-card reveal" data-skill="cloud">`
- Collaboration → `<div class="skill-card reveal" data-skill="collaboration">`
- Datacentre → `<div class="skill-card reveal" data-skill="datacentre">`
- Automation & Dev → `<div class="skill-card reveal" data-skill="ai">`

- [ ] **Step 3: Tag the career bullets**

Add `data-skills` (space-separated, may list several) to each `<li>` in the timeline. Apply this mapping by matching the bullet's leading text:

**Sword Group (2024–Present):**
- "Designed and delivered a resilient, multi-region Cisco ISE, Palo Alto..." → `data-skills="security cloud networking"`
- "Architected a secure cloud based (Azure) AI platform..." → `data-skills="ai cloud security"`
- "Manage and mentor a team of 7 consultants..." → `data-skills="techlead"`
- "Define solution architecture and set technical standards..." → `data-skills="techlead networking"`
- "Directed a multi-datacentre & offshore transformation programme..." → `data-skills="datacentre networking security"`
- "Delivered campus-wide firewall and LAN refresh programmes..." → `data-skills="security networking"`
- "Championed DevOps practices within the team..." → `data-skills="ai techlead"`

**Ping Network Solutions (2019–2024):**
- "Designed and implemented end-to-end solutions..." → `data-skills="networking security collaboration"`
- "Led a multi-site migration from legacy BGP/IPsec VPN..." → `data-skills="networking"`
- "Designed and delivered Cisco SD-WAN with an active/active Palo Alto..." → `data-skills="cloud networking security"`
- "Managed the migration of 2,000 users from Cisco CUCM to Microsoft Teams..." → `data-skills="collaboration"`
- "Led a datacentre refresh introducing modern Cisco Nexus switching..." → `data-skills="datacentre"`
- "Designed and built a bespoke hosted management and monitoring platform..." → `data-skills="datacentre ai"`

**Virgin Media Business (2015–2019):**
- "Provided technical leadership and consultation for large public sector accounts" → `data-skills="techlead networking"`
- "Delivered a comprehensive LAN/WAN and datacentre redesign using Cisco Nexus 9K..." → `data-skills="datacentre networking"`
- "Led a datacentre refresh incorporating Clustered Cisco UCS 5508..." → `data-skills="datacentre"`
- "Designed and implemented a secure video conferencing system..." → `data-skills="collaboration security"`
- "Delivered multiple large infrastructure projects including LAN refreshes, firewall migrations, and SIP integrations" → `data-skills="networking security collaboration"`

**Jabil Senior Network Engineer (2007–2015):**
- "Designed and implemented network, security, and voice solutions..." → `data-skills="networking security collaboration"`
- "Led a European-wide deployment of a global LAN, WAN, and Cisco telephony refresh across 112 sites" → `data-skills="networking collaboration"`
- "Delivered two $3M datacentre builds in London and Budapest" → `data-skills="datacentre"`
- "Served as technical lead for the acquisition integration..." → `data-skills="techlead networking"`

**Jabil Network Engineer (2003–2007):**
- "Managed the installation and support of converged data and voice networks..." → `data-skills="networking collaboration"`
- "Designed bespoke routing and traffic engineering solutions using BGP and OSPF" → `data-skills="networking"`
- "Delivered telephony and wireless solutions across multiple European sites" → `data-skills="collaboration networking"`
- "Designed VPN solutions for third-party integrations and secure remote access" → `data-skills="security networking"`

- [ ] **Step 4: Bump the stylesheet cache-buster**

In `worker/public/index.html`, change `<link rel="stylesheet" href="styles.css?v=12">` to `href="styles.css?v=13"`.

- [ ] **Step 5: Add ordering CSS to `worker/public/styles.css`**

Append this block to the end of `worker/public/styles.css`:

```css
/* ===== Persona re-emphasis ===== */
/* Containers become order-aware. Existing visual styling is unchanged because
   flex on these wrappers preserves the current single-direction layout. */
.about-stats { display: flex; flex-direction: column; }
.skills-grid { /* already a grid; order works on grid items too */ }
.timeline-list { display: flex; flex-direction: column; }

/* Float the active persona's elements to the front of their group. -1 beats the
   default 0 of every sibling, so the matched item leads without hiding anything. */
[data-persona="security"] .about-stat[data-skill="security"],
[data-persona="security"] .skill-card[data-skill="security"],
[data-persona="security"] .timeline-list li[data-skills~="security"] { order: -1; }

[data-persona="cloud"] .about-stat[data-skill="cloud"],
[data-persona="cloud"] .skill-card[data-skill="cloud"],
[data-persona="cloud"] .timeline-list li[data-skills~="cloud"] { order: -1; }

[data-persona="ai"] .about-stat[data-skill="ai"],
[data-persona="ai"] .skill-card[data-skill="ai"],
[data-persona="ai"] .timeline-list li[data-skills~="ai"] { order: -1; }

[data-persona="techlead"] .about-stat[data-skill="techlead"],
[data-persona="techlead"] .skill-card[data-skill="techlead"],
[data-persona="techlead"] .timeline-list li[data-skills~="techlead"] { order: -1; }

[data-persona="collaboration"] .about-stat[data-skill="collaboration"],
[data-persona="collaboration"] .skill-card[data-skill="collaboration"],
[data-persona="collaboration"] .timeline-list li[data-skills~="collaboration"] { order: -1; }

[data-persona="datacentre"] .about-stat[data-skill="datacentre"],
[data-persona="datacentre"] .skill-card[data-skill="datacentre"],
[data-persona="datacentre"] .timeline-list li[data-skills~="datacentre"] { order: -1; }

[data-persona="networking"] .skill-card[data-skill="networking"],
[data-persona="networking"] .timeline-list li[data-skills~="networking"] { order: -1; }
```

- [ ] **Step 6: Manual verification (the part tests can't cover)**

Run: `cd worker && npx wrangler dev`
- Generic (no KV value): tiles/cards/career appear in their original order.
- Set `active_persona=security` (via `wrangler kv ... --local` or the admin panel): open `http://localhost:8787/`, throttle network in DevTools, hard-reload. Confirm the **Security** tile + Expertise card lead their groups and security career bullets float up, with **no flash** of the old order. Confirm hero eyebrow/tagline + about lead show the security copy.
- Repeat for `cloud` and one more persona. Reset KV to confirm generic restores exactly.

Note: if a flex container's existing CSS relied on `block` layout in a way that visually shifts, adjust by adding the existing gap/spacing to the flex rule (e.g. `gap`) to match the prior look. Verify About tiles and timeline spacing match the current site.

- [ ] **Step 7: Commit**

```bash
git add worker/public/index.html worker/public/styles.css
git commit -m "feat: data-skill tagging + persona ordering CSS for website"
```

---

## Task 9: Persona-tailored PDF

**Files:**
- Modify: `worker-pdf/src/template.html`
- Modify: `worker-pdf/src/index.js`

The PDF is rendered by headless Chrome, so the same CSS-order trick works. The main worker passes the persona via `X-Persona` (Task 6). The template gets `data-skill` attributes + order CSS + a summary token; `index.js` injects the persona id on `<body>`, swaps the summary, and folds the persona into the cache key.

- [ ] **Step 1: Tag the PDF skill tags + add order CSS**

In `worker-pdf/src/template.html`:
- Add `data-skill` to each `.skill-group` (match by `<h3>`): Security→`security`, Cloud & Hybrid→`cloud`, etc., mirroring the mapping in Task 8 Step 2 as applicable to the PDF's groups.
- Inside the template `<style>`, make the skill-groups container order-aware (`display:flex;flex-direction:column;` on the wrapping element) and add per-persona rules:

```css
body[data-persona="security"] .skill-group[data-skill="security"] { order: -1; }
body[data-persona="cloud"] .skill-group[data-skill="cloud"] { order: -1; }
body[data-persona="ai"] .skill-group[data-skill="ai"] { order: -1; }
body[data-persona="collaboration"] .skill-group[data-skill="collaboration"] { order: -1; }
body[data-persona="datacentre"] .skill-group[data-skill="datacentre"] { order: -1; }
body[data-persona="networking"] .skill-group[data-skill="networking"] { order: -1; }
```

- Add a summary placeholder token where the professional summary/intro line sits: `<!--PERSONA_SUMMARY-->` inside the existing summary element (leave the current text as the generic default, wrapped so it can be replaced — e.g. `<span id="persona-summary">…current text…</span>`).

- [ ] **Step 2: Inject persona in `worker-pdf/src/index.js`**

At the top, import the persona data and a tiny applier. Add near the other imports:

```js
import { PERSONAS, resolvePersona } from "./personas.js";
```

Create `worker-pdf/src/personas.js` as a **synced copy** of `worker/src/personas.js` (same content) with this header comment on line 1:

```js
// SYNCED COPY of worker/src/personas.js — keep in sync. Separate wrangler project
// cannot import across the worker boundary.
```

Then, inside `fetch`, after computing `debug`, derive the persona and transform the template string before `setContent`:

```js
        const personaId = request.headers.get("X-Persona")
            || new URL(request.url).searchParams.get("persona")
            || "generic";
        const persona = resolvePersona(personaId);

        let html = templateHtml;
        if (persona.id !== "generic") {
            html = html
                .replace("<body", `<body data-persona="${persona.id}"`)
                .replace(/<span id="persona-summary">[\s\S]*?<\/span>/,
                    `<span id="persona-summary">${persona.aboutLead}</span>`);
        }
```

Replace `await page.setContent(templateHtml, ...)` with `await page.setContent(html, ...)`.

- [ ] **Step 3: Fold the persona into the cache key**

Change the cache key so each persona caches separately. Replace the `CACHE_KEY` constant usage with a per-persona key built inside `fetch`:

```js
        const cacheKey = new Request(`https://steven-cv-pdf.internal/Steven_Johnston_CV-${PDF_VERSION}-${persona.id}.pdf`);
```

Remove the old module-level `CACHE_KEY`/`cacheKey` lines that are now superseded (keep `PDF_VERSION`). Bump `PDF_VERSION` to `"5"`.

- [ ] **Step 4: Manual verification**

Run: `cd worker-pdf && npx wrangler dev`
- `curl -s "http://localhost:8787/?debug&persona=security" --output sec.png` and open it — confirm the Security skill group leads and the summary shows the security copy.
- `curl -s "http://localhost:8787/?debug" --output gen.png` — confirm generic is unchanged from the current PDF layout.

- [ ] **Step 5: Commit**

```bash
git add worker-pdf/src/template.html worker-pdf/src/index.js worker-pdf/src/personas.js
git commit -m "feat: persona-tailored PDF rendering"
```

---

## Task 10: Review persona copy with Steven

**Files:** none (content review)

- [ ] **Step 1:** Present the seven personas' `eyebrow`, `tagline`, `aboutLead`, and `chatbotFocus` (from `worker/src/personas.js`) to Steven.
- [ ] **Step 2:** Apply any wording edits directly in `worker/src/personas.js` (and the synced `worker-pdf/src/personas.js`).
- [ ] **Step 3:** Re-run `cd worker && npx vitest run` to confirm nothing broke.
- [ ] **Step 4:** Commit any edits: `git commit -am "copy: refine persona wording per review"`.

---

## Task 11: Secrets, deploy, and live verification

**Files:** none (deployment)

- [ ] **Step 1: Create local dev secrets**

Create `worker/.dev.vars` (gitignored — confirm it is, or add to `.gitignore`):

```
ADMIN_PASSWORD=choose-a-strong-password
COOKIE_SECRET=long-random-string-min-32-chars
```

Create the same `worker-pdf/.dev.vars` only if the PDF worker needs them (it does not use auth, so skip).

- [ ] **Step 2: Set production secrets on the main worker**

Run:
```
cd worker
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put COOKIE_SECRET
```
Enter strong values when prompted. Expected: "Success! Uploaded secret …" for each.

- [ ] **Step 3: Full test suite**

Run: `cd worker && npx vitest run`
Expected: ALL tests pass (personas, auth, render, admin, chat-focus).

- [ ] **Step 4: Deploy both workers**

Run:
```
cd worker-pdf && npx wrangler deploy
cd ../worker && npx wrangler deploy
```
Expected: both deploy successfully. (Deploy PDF first so the service binding target is current.)

- [ ] **Step 5: Live verification**

- Visit `https://steven.clydeford.net/manage-7fq2x9` (your slug) → password form. Wrong password → rejected. Correct → panel.
- Select **Security** → reload `https://steven.clydeford.net/` → Security leads tiles/cards/career; hero + about copy updated; no flash.
- Download the PDF → Security-tailored. Ask the chatbot "what does Steven do?" → leads with security.
- Set back to **Generic** → site/PDF/chatbot match the original.

- [ ] **Step 6: Commit any config changes**

```bash
git add worker/.gitignore worker-pdf/.gitignore 2>/dev/null
git commit -m "chore: gitignore dev vars" || echo "nothing to commit"
```

---

## Self-Review notes

- **Spec coverage:** tiles/cards reorder (Task 8), hero+about swap (Tasks 4, 8), career reorder (Task 8), PDF (Task 9), chatbot (Task 7), global KV toggle (Tasks 5, 6), admin password + obscure URL + signed cookie (Tasks 3, 5, 6), eight personas incl. generic (Task 2). All spec sections map to tasks.
- **Networking caveat:** there is no "Networking" About tile, so the Networking persona floats the Infrastructure Expertise card + career bullets only (documented in the mapping table and Task 8 Step 5 CSS — note no `.about-stat` rule for networking). Intentional, not a gap.
- **Type consistency:** `resolvePersona` returns the persona object (with `.id`) everywhere; `handleAdmin(request, env, base)` signature matches its call in `index.js`; `applyPersonaToHtml(response, persona)` matches; `handleChat(request, env, ctx, persona)` matches; `ADMIN_COOKIE` exported and reused in tests.
- **PDF import boundary:** resolved by a synced copy of `personas.js` (Task 9 Step 2) — flagged open item from the spec now closed.
