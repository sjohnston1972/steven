import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { handleAdmin, ADMIN_COOKIE } from "../src/admin.js";
import { signSession } from "../src/auth.js";

const BASE = "/manage-test";
const PW = "s3cret";
const CS = "cookie-secret";
const testEnv = (overrides = {}) => ({
    CHAT_KV: env.CHAT_KV,
    ADMIN_PASSWORD: PW,
    COOKIE_SECRET: CS,
    ADMIN_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides,
});

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
    beforeEach(async () => {
        await env.CHAT_KV.delete("active_persona");
        await env.CHAT_KV.delete("admin_session_gen");
    });

    it("shows the password form when unauthenticated", async () => {
        const r = await handleAdmin(get(), testEnv(), BASE);
        const html = await r.text();
        expect(r.status).toBe(200);
        expect(html).toContain("type=\"password\"");
        expect(html).not.toContain("Active persona");
    });

    it("rejects a wrong password", async () => {
        const r = await handleAdmin(post({ action: "login", password: "wrong" }), testEnv(), BASE);
        expect(r.status).toBe(401);
        expect(r.headers.get("Set-Cookie")).toBeNull();
    });

    it("shows the login form when the cookie is invalid", async () => {
        const r = await handleAdmin(get("not-a-valid-token"), testEnv(), BASE);
        expect(r.status).toBe(200);
        const html = await r.text();
        expect(html).toContain("type=\"password\"");
        expect(html).not.toContain("Active persona");
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

    describe("login rate limiting", () => {
        const limited = () => testEnv({ ADMIN_LIMITER: { limit: async () => ({ success: false }) } });

        it("returns 429 with the login form when the limiter trips", async () => {
            const r = await handleAdmin(post({ action: "login", password: "wrong" }), limited(), BASE);
            expect(r.status).toBe(429);
            expect(await r.text()).toContain("type=\"password\"");
        });

        it("does not evaluate the password once limited", async () => {
            const r = await handleAdmin(post({ action: "login", password: PW }), limited(), BASE);
            expect(r.status).toBe(429);
            expect(r.headers.get("Set-Cookie")).toBeNull();
        });

        it("keys the limiter by the connecting IP", async () => {
            const keys = [];
            const env2 = testEnv({ ADMIN_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: true }; } } });
            const req = post({ action: "login", password: "wrong" });
            req.headers.set("CF-Connecting-IP", "203.0.113.9");
            await handleAdmin(req, env2, BASE);
            expect(keys).toEqual(["203.0.113.9"]);
        });

        it("does not rate limit authenticated panel actions", async () => {
            const token = await signSession(CS, 60_000);
            const r = await handleAdmin(post({ action: "set", persona: "security" }, token), limited(), BASE);
            expect(r.status).toBe(303);
            expect(await env.CHAT_KV.get("active_persona")).toBe("security");
        });
    });

    describe("logout revocation", () => {
        async function login() {
            const r = await handleAdmin(post({ action: "login", password: PW }), testEnv(), BASE);
            expect(r.status).toBe(303);
            return r.headers.get("Set-Cookie").match(new RegExp(`${ADMIN_COOKIE}=([^;]+)`))[1];
        }

        it("rejects a token minted before logout, in any browser", async () => {
            const stolen = await login();
            // Panel works with the token before logout.
            expect(await (await handleAdmin(get(stolen), testEnv(), BASE)).text()).toContain("Active persona");
            await handleAdmin(post({ action: "logout" }, stolen), testEnv(), BASE);
            // The same token (e.g. leaked to another device) no longer works.
            const after = await handleAdmin(get(stolen), testEnv(), BASE);
            expect(await after.text()).not.toContain("Active persona");
            const setPost = await handleAdmin(post({ action: "set", persona: "security" }, stolen), testEnv(), BASE);
            expect(setPost.status).toBe(403);
            expect(await env.CHAT_KV.get("active_persona")).toBeNull();
        });

        it("allows logging in again after logout", async () => {
            const first = await login();
            await handleAdmin(post({ action: "logout" }, first), testEnv(), BASE);
            const second = await login();
            const r = await handleAdmin(get(second), testEnv(), BASE);
            expect(await r.text()).toContain("Active persona");
        });
    });

    describe("missing COOKIE_SECRET", () => {
        const noSecretEnv = () => ({ CHAT_KV: env.CHAT_KV, ADMIN_PASSWORD: PW });

        it("returns a controlled response on GET, even with a cookie", async () => {
            const token = await signSession(CS, 60_000);
            const r = await handleAdmin(get(token), noSecretEnv(), BASE);
            expect(r.status).toBe(500);
            expect(await r.text()).toContain("misconfigured");
        });

        it("never mints a session, even with the right password", async () => {
            const r = await handleAdmin(post({ action: "login", password: PW }), noSecretEnv(), BASE);
            expect(r.status).toBe(500);
            expect(r.headers.get("Set-Cookie")).toBeNull();
        });
    });
});
