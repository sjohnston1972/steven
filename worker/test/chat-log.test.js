import { describe, it, expect } from "vitest";
import { accumulateReply, detectCta } from "../src/chat.js";

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

describe("detectCta", () => {
    it("fires on Steven's email address", () => {
        expect(detectCta("You can reach him at stevie.johnston@gmail.com any time.")).toBe(true);
    });

    it("fires on the LinkedIn profile URL", () => {
        expect(detectCta("Connect on linkedin.com/in/steven-johnston-474a5333.")).toBe(true);
    });

    it("fires on contact phrases regardless of case", () => {
        expect(detectCta("The best way is to Email Steven directly, or grab his CV from the download link on this page.")).toBe(true);
        expect(detectCta("Feel free to GET IN TOUCH via the site.")).toBe(true);
    });

    it("stays false for purely informational replies", () => {
        expect(detectCta("Steven has hands-on experience across cloud and hybrid environments, including migrations, networking and identity.")).toBe(false);
        expect(detectCta("Yes. Steven works across security tooling and hardening, with experience in detection, response and building defensive automation.")).toBe(false);
    });

    it("handles empty and non-string input", () => {
        expect(detectCta("")).toBe(false);
        expect(detectCta(undefined)).toBe(false);
    });
});
