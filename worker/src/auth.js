// Signed-session helpers for the admin panel. Token =
// "<expiryMs>.<gen>.<hmac>", HMAC-SHA256 over "<expiryMs>.<gen>" using
// COOKIE_SECRET. The generation is a server-side counter (KV) bumped on
// logout, so outstanding tokens can be revoked despite carrying no DB state.

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
export async function signSession(secret, ttlMs, gen = 0) {
    if (!secret) throw new Error("COOKIE_SECRET not configured");
    const payload = `${String(Date.now() + ttlMs)}.${gen}`;
    const sig = await hmac(secret, payload);
    return `${payload}.${sig}`;
}

export async function verifySession(secret, token, currentGen = 0) {
    // Fail closed: WebCrypto rejects zero-length HMAC keys, so an unset
    // secret must short-circuit here rather than throw inside hmac().
    if (!secret) return false;
    if (!token || typeof token !== "string") return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [expiry, gen, sig] = parts;
    if (!/^\d+$/.test(expiry) || !/^\d+$/.test(gen)) return false;
    const expected = await hmac(secret, `${expiry}.${gen}`);
    if (!timingSafeEqual(sig, expected)) return false;
    if (Number(gen) !== Number(currentGen)) return false;
    return Number(expiry) > Date.now();
}
