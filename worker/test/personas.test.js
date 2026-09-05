import { describe, it, expect } from "vitest";
import { PERSONAS, DEFAULT_PERSONA, resolvePersona } from "../src/personas.js";

describe("personas", () => {
    it("has generic as the default", () => {
        expect(DEFAULT_PERSONA).toBe("generic");
        expect(PERSONAS.generic.default).toBe(true);
    });

    it("defines all ten personas", () => {
        expect(Object.keys(PERSONAS).sort()).toEqual(
            ["ai", "cloud", "collaboration", "datacentre", "generic", "identity", "networking", "ot", "security", "techlead"].sort()
        );
    });

    it("every non-generic persona has copy + a skill", () => {
        for (const [id, p] of Object.entries(PERSONAS)) {
            if (id === "generic") continue;
            expect(p.skill, id).toBeTruthy();
            expect(p.eyebrow, id).toBeTruthy();
            expect(p.tagline, id).toBeTruthy();
            expect(p.aboutLead, id).toBeTruthy();
            expect(p.chatbotFocus, id).toBeTruthy();
        }
    });

    it("resolvePersona returns generic for unknown/empty input", () => {
        expect(resolvePersona(null).id).toBe("generic");
        expect(resolvePersona("nope").id).toBe("generic");
        expect(resolvePersona("security").id).toBe("security");
    });
});
