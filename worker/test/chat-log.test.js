import { describe, it, expect } from "vitest";
import { accumulateReply } from "../src/chat.js";

function sseStream(chunks) {
    const enc = new TextEncoder();
    return new ReadableStream({
        start(controller) {
            for (const c of chunks) controller.enqueue(enc.encode(c));
            controller.close();
        },
    });
}

describe("accumulateReply", () => {
    it("concatenates response tokens across SSE events", async () => {
        const stream = sseStream([
            'data: {"response":"Hello"}\n\n',
            'data: {"response":", "}\n\n',
            'data: {"response":"world"}\n\n',
            "data: [DONE]\n\n",
        ]);
        expect(await accumulateReply(stream)).toBe("Hello, world");
    });

    it("reassembles tokens split across chunk boundaries", async () => {
        const stream = sseStream([
            'data: {"resp',
            'onse":"Hi"}\n\nda',
            'ta: {"response":"!"}\n\n',
        ]);
        expect(await accumulateReply(stream)).toBe("Hi!");
    });

    it("ignores [DONE], blank lines and malformed JSON", async () => {
        const stream = sseStream([
            "data: [DONE]\n\n",
            "\n",
            "data: not-json\n\n",
            'data: {"response":"ok"}\n\n',
        ]);
        expect(await accumulateReply(stream)).toBe("ok");
    });

    it("parses a final data line that lacks a trailing newline", async () => {
        const stream = sseStream([
            'data: {"response":"a"}\n\n',
            'data: {"response":"b"}',
        ]);
        expect(await accumulateReply(stream)).toBe("ab");
    });

    it("resolves cleanly when the stream is cut off mid-JSON", async () => {
        const stream = sseStream(['data: {"resp']);
        expect(await accumulateReply(stream)).toBe("");
    });
});
