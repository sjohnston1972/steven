import { PERSONAS } from "./personas.js";
import { signSession, verifySession, timingSafeEqual } from "./auth.js";

export const ADMIN_COOKIE = "sj_admin";
const KV_KEY = "active_persona";
const GEN_KEY = "admin_session_gen";
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
    const secret = env.COOKIE_SECRET;
    // Fail closed, deliberately: without the signing secret no session can be
    // verified or minted, so return a controlled error instead of letting
    // WebCrypto throw on an empty HMAC key.
    if (!secret) {
        return htmlResponse(page("<h1>Manage</h1><p>This panel is misconfigured: COOKIE_SECRET is not set.</p>"), 500);
    }
    // A KV failure must not take down the whole panel: fall back to gen 0 so
    // the login form still renders. Sessions minted at a bumped generation
    // fail verification until KV recovers, which errs toward re-login.
    let gen = 0;
    try {
        gen = Number(await env.CHAT_KV.get(GEN_KEY)) || 0;
    } catch (e) {
        console.error("admin_gen_read_error", String(e));
    }
    const authed = await verifySession(secret, readCookie(request, ADMIN_COOKIE), gen);

    if (request.method === "GET") {
        return authed
            ? htmlResponse(panel(base, (await env.CHAT_KV.get(KV_KEY)) || "generic"))
            : htmlResponse(loginForm(base));
    }

    if (request.method === "POST") {
        let form;
        try {
            form = await request.formData();
        } catch {
            return htmlResponse(loginForm(base, "Invalid request."), 400);
        }
        const action = form.get("action");

        if (action === "login") {
            // Throttle login attempts per IP before touching the password, so
            // the admin password can't be brute-forced. Separate binding from
            // the chat limiter so chat traffic can't lock out the admin.
            if (env.ADMIN_LIMITER) {
                const ip = request.headers.get("CF-Connecting-IP") || "unknown";
                const { success } = await env.ADMIN_LIMITER.limit({ key: ip });
                if (!success) {
                    return htmlResponse(loginForm(base, "Too many attempts, try again shortly."), 429);
                }
            } else {
                // Don't lock the admin out over a config slip, but make the
                // missing throttle loudly visible in the logs.
                console.error("admin_limiter_missing", "ADMIN_LIMITER binding absent — login throttling disabled");
            }
            const password = form.get("password") || "";
            const expected = env.ADMIN_PASSWORD || "";
            if (!expected || !timingSafeEqual(password, expected)) {
                return htmlResponse(loginForm(base, "Incorrect password."), 401);
            }
            const token = await signSession(secret, SESSION_TTL_MS, gen);
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
            // Bumping the generation invalidates every outstanding admin
            // session everywhere, not just this browser's cookie — the right
            // trade-off for a single-admin site (revokes leaked tokens too).
            // KV is eventually consistent, so revocation (and a login racing
            // this logout) can lag up to ~60s at other locations; acceptable
            // for one admin, who normally acts from a single location.
            await env.CHAT_KV.put(GEN_KEY, String(gen + 1));
            return new Response(null, {
                status: 303,
                headers: { Location: base, "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` },
            });
        }
    }

    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
}
