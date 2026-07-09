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
