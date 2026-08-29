import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyPersonaToTemplate, promoteSkillGroup } from "../src/render.js";
import { PERSONAS, resolvePersona } from "../src/personas.js";

// The real template, read with fs — the .html import in index.js only works
// under wrangler's bundler.
const template = readFileSync(new URL("../src/template.html", import.meta.url), "utf8");

const GENERIC_SUMMARY = "I lead the technical design and delivery of infrastructure projects";

const skillOrder = (html) =>
    [...html.matchAll(/<li data-skill="([a-z]+)"/g)].map((m) => m[1]);

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

    it("does not treat $-sequences in an aboutLead as replacement patterns", () => {
        const out = applyPersonaToTemplate(template, { id: "odd", aboutLead: "Saved $3M & $' $` $&" });
        expect(out).toContain("<span id=\"persona-summary\">Saved $3M & $' $` $&</span>");
    });

    it("lifts the persona's skills row to the top of the list", () => {
        const out = applyPersonaToTemplate(template, PERSONAS.datacentre);
        expect(skillOrder(out)[0]).toBe("datacentre");
    });

    it("promotes a skills row for every persona that names one", () => {
        for (const persona of Object.values(PERSONAS)) {
            if (!persona.skill) continue;
            const out = applyPersonaToTemplate(template, persona);
            expect(skillOrder(out)[0]).toBe(persona.skill);
        }
    });
});

describe("promoteSkillGroup", () => {
    it("keeps every skills row exactly once and preserves the relative order of the rest", () => {
        const before = skillOrder(template);
        const after = skillOrder(promoteSkillGroup(template, "ai"));
        expect(after).toHaveLength(before.length);
        expect([...after].sort()).toEqual([...before].sort());
        expect(after.slice(1)).toEqual(before.filter((s) => s !== "ai"));
    });

    it("is a no-op for a missing skill, a falsy skill, or one already first", () => {
        expect(promoteSkillGroup(template, "nonexistent")).toBe(template);
        expect(promoteSkillGroup(template, undefined)).toBe(template);
        expect(promoteSkillGroup(template, skillOrder(template)[0])).toBe(template);
    });

    it("leaves markup without a skills list alone", () => {
        expect(promoteSkillGroup("<p>no list here</p>", "ai")).toBe("<p>no list here</p>");
    });
});
