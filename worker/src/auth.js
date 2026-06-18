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
