import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { applyPersonaToTemplate } from "../src/render.js";
import { PERSONAS } from "../src/personas.js";

const template = readFileSync(new URL("../src/template.html", import.meta.url), "utf8");

// Guards on the properties that make the rendered PDF parse cleanly in an
// applicant tracking system. Each one is a regression that would silently cost
// Steven keyword matches — the PDF still *looks* fine when these break.
describe("ATS-friendly template", () => {
    it("declares the sections an ATS looks for, in the conventional order", () => {
        const headings = [...template.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
        expect(headings).toEqual([
            "PROFESSIONAL SUMMARY",
            "TECHNICAL SKILLS",
            "PROFESSIONAL EXPERIENCE",
            "CERTIFICATIONS AND CLEARANCE",
        ]);
    });

    it("carries the contact details as extractable text", () => {
        expect(template).toContain("Steven Johnston");
        expect(template).toContain("stevie.johnston@gmail.com");
        expect(template).toContain("linkedin.com/in/steven-johnston-474a5333");
        expect(template).toContain("Glasgow, Scotland");
    });

    it("keeps the name in a single text run so it parses as one name", () => {
        expect(template).toMatch(/<p class="name">Steven Johnston<\/p>/);
    });

    it("uses a single linear column — no multi-column or flex layout", () => {
        const css = template.match(/<style>([\s\S]*?)<\/style>/)[1];
        const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
        expect(rules).not.toMatch(/display:\s*(flex|grid)/);
        expect(rules).not.toMatch(/\bcolumn-count\b|\bcolumns:/);
        expect(rules).not.toMatch(/\border:\s*-?\d/);      // flex `order`, which would
        expect(rules).not.toMatch(/^\s*order:/m);          // desync visual and text order
        expect(rules).not.toMatch(/position:\s*absolute/);
    });

    it("never clips content to a fixed page height", () => {
        const css = template.match(/<style>([\s\S]*?)<\/style>/)[1];
        const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
        expect(rules).not.toMatch(/overflow:\s*hidden/);
        // `line-height` is fine; a set `height`/`max-height` is what crops.
        expect(rules).not.toMatch(/(?:^|[\s;{])(?:max-)?height:\s*\d/m);
    });

    it("uses standard locally-available fonts with no webfont fetch", () => {
        expect(template).not.toContain("fonts.googleapis.com");
        expect(template).not.toContain("@font-face");
        expect(template).toMatch(/font-family:\s*Arial/);
    });

    it("has no images, icons, tables, or text boxes for a parser to trip on", () => {
        expect(template).not.toMatch(/<(img|svg|table|canvas|object|iframe)\b/i);
        expect(template).not.toMatch(/background-image|url\(/);
    });

    it("uses real list markup for bullets rather than CSS-drawn shapes", () => {
        expect(template).toMatch(/<ul[\s\S]*?<li/);
        const css = template.match(/<style>([\s\S]*?)<\/style>/)[1];
        expect(css).not.toMatch(/list-style:\s*none/);
        expect(css).not.toMatch(/::before/);
    });

    it("dates every role in a plain, parseable range", () => {
        const dates = [...template.matchAll(/\|\s*(\d{4} - (?:\d{4}|Present))<\/p>/g)];
        expect(dates).toHaveLength(5);
    });

    it("stays ATS-clean once a persona has been applied", () => {
        const out = applyPersonaToTemplate(template, PERSONAS.ai);
        expect(out).not.toMatch(/<(img|svg|table)\b/i);
        expect([...out.matchAll(/<h2>/g)]).toHaveLength(4);
        expect([...out.matchAll(/<li data-skill=/g)]).toHaveLength(7);
    });
});
