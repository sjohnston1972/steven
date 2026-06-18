import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../src/chat.js";
import { SYSTEM_PROMPT } from "../src/persona.js";
import { PERSONAS } from "../src/personas.js";

describe("chatbot persona focus", () => {
    it("is unchanged for generic", () => {
        expect(buildSystemPrompt(PERSONAS.generic)).toBe(SYSTEM_PROMPT);
    });

    it("is unchanged when persona is missing", () => {
        expect(buildSystemPrompt(undefined)).toBe(SYSTEM_PROMPT);
    });

    it("appends the focus for a focused persona", () => {
        const out = buildSystemPrompt(PERSONAS.security);
        expect(out.startsWith(SYSTEM_PROMPT)).toBe(true);
        expect(out).toContain(PERSONAS.security.chatbotFocus);
        expect(out).toContain("Current focus");
    });

    it("keeps all guardrails (base prompt is a prefix)", () => {
        const out = buildSystemPrompt(PERSONAS.cloud);
        expect(out.startsWith(SYSTEM_PROMPT)).toBe(true);
    });
});
