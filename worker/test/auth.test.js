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
        // Flip the last character only, keeping length equal so verification
        // exercises the constant-time HMAC compare rather than the length guard.
        const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
        expect(await verifySession(SECRET, tampered)).toBe(false);
    });

    it("rejects a token signed with the wrong secret", async () => {
        const token = await signSession("a-different-secret", 60_000);
        expect(await verifySession(SECRET, token)).toBe(false);
    });

    it("rejects an expired token", async () => {
        const token = await signSession(SECRET, -1000); // already expired
        expect(await verifySession(SECRET, token)).toBe(false);
    });

    it("rejects garbage", async () => {
        expect(await verifySession(SECRET, "")).toBe(false);
        expect(await verifySession(SECRET, "nonsense")).toBe(false);
    });

    it("returns false without throwing when the secret is empty", async () => {
        const token = await signSession(SECRET, 60_000);
        expect(await verifySession("", token)).toBe(false);
        expect(await verifySession(undefined, token)).toBe(false);
    });

    it("signSession throws a clear error when the secret is missing", async () => {
        await expect(signSession("", 60_000)).rejects.toThrow(/COOKIE_SECRET/);
    });
});
