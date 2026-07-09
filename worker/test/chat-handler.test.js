import { describe, it, expect } from "vitest";
import { handleChat } from "../src/chat.js";

const ORIGIN = "https://steven.clydeford.net";

function chatRequest() {
    return new Request(ORIGIN + "/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Origin": ORIGIN,
            "CF-Connecting-IP": "198.51.100.7",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
}

function sseStream(chunks) {
    const enc = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const c of chunks) controller.enqueue(enc.encode(c));
            controller.close();
        },
    });
}

// Every binding handleChat touches can be a plain object stub.
function stubEnv({ aiRun }) {
    const kvPuts = [];
    const dbRuns = [];
    return {
        env: {
            CHAT_LIMITER: { limit: async () => ({ success: true }) },
            CHAT_KV: {
                get: async () => null,
                put: async (key, value) => { kvPuts.push({ key, value }); },
            },
            AI: { run: aiRun },
            DB: { prepare: () => ({ bind: () => ({ run: async () => { dbRuns.push(true); } }) }) },
        },
        kvPuts,
        dbRuns,
    };
}

function stubCtx() {
    const pending = [];
    return { ctx: { waitUntil: (p) => pending.push(p) }, pending };
}

describe("handleChat AI failure handling", () => {
    it("returns a JSON 503 when the AI call rejects", async () => {
        const { env } = stubEnv({ aiRun: async () => { throw new Error("model down"); } });
        const { ctx } = stubCtx();
        const res = await handleChat(chatRequest(), env, ctx, null);
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toBe("ai_unavailable");
        expect(typeof body.message).toBe("string");
        expect(body.message.length).toBeGreaterThan(0);
    });

    it("does not consume daily quota when the AI call fails", async () => {
        const { env, kvPuts } = stubEnv({ aiRun: async () => { throw new Error("model down"); } });
        const { ctx, pending } = stubCtx();
        await handleChat(chatRequest(), env, ctx, null);
        await Promise.all(pending);
        expect(kvPuts).toEqual([]);
    });

    it("streams and increments counters when the AI call succeeds", async () => {
        const { env, kvPuts } = stubEnv({
            aiRun: async () => sseStream(['data: {"response":"hello"}\n\n', "data: [DONE]\n\n"]),
        });
        const { ctx, pending } = stubCtx();
        const res = await handleChat(chatRequest(), env, ctx, null);
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("text/event-stream");
        await res.text(); // drain the client branch
        await Promise.all(pending);
        const keys = kvPuts.map((p) => p.key);
        expect(keys.some((k) => k.includes("198.51.100.7"))).toBe(true);
        expect(keys.some((k) => k.includes("_global"))).toBe(true);
    });
});
