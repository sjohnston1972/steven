import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyPersonaToTemplate } from "../src/render.js";
import { PERSONAS, resolvePersona } from "../src/personas.js";

// The real template, read with fs — the .html import in index.js only works
// under wrangler's bundler.
const template = readFileSync(new URL("../src/template.html", import.meta.url), "utf8");

const GENERIC_SUMMARY = "I lead the technical design and delivery of infrastructure projects";

describe("applyPersonaToTemplate", () => {
    it("returns the template untouched for the generic persona", () => {
        expect(applyPersonaToTemplate(template, PERSONAS.generic)).toBe(template);
        expect(applyPersonaToTemplate(template, resolvePersona("generic"))).toBe(template);
    });

    it("returns the template untouched for null/undefined personas", () => {
        expect(applyPersonaToTemplate(template, null)).toBe(template);
        expect(applyPersonaToTemplate(template, undefined)).toBe(template);
    });

    it("tags the body and swaps the summary for a focused persona", () => {
        const out = applyPersonaToTemplate(template, PERSONAS.security);
        expect(out).toContain('<body data-persona="security"');
        expect(out).toContain(PERSONAS.security.aboutLead);
        expect(out).not.toContain(GENERIC_SUMMARY);
    });

    it("tags the body but leaves the summary alone without an aboutLead", () => {
        const out = applyPersonaToTemplate(template, { id: "custom" });
        expect(out).toContain('<body data-persona="custom"');
        expect(out).toContain(GENERIC_SUMMARY);
    });

    it("leaves exactly one persona-summary span after transformation", () => {
        const out = applyPersonaToTemplate(template, PERSONAS.cloud);
        const spans = out.match(/<span id="persona-summary">/g) || [];
        expect(spans.length).toBe(1);
    });
});
