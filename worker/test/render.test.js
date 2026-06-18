import { describe, it, expect } from "vitest";
import { applyPersonaToHtml } from "../src/render.js";
import { PERSONAS } from "../src/personas.js";

const SAMPLE = `<!DOCTYPE html><html><body class="light">
<p class="hero-eyebrow">OLD EYEBROW</p>
<p class="hero-tagline">OLD TAGLINE</p>
<p class="about-lead">OLD LEAD</p>
</body></html>`;

function res(html) {
    return new Response(html, { headers: { "Content-Type": "text/html" } });
}

describe("applyPersonaToHtml", () => {
    it("leaves markup unchanged for generic (no data-persona)", async () => {
        const out = await applyPersonaToHtml(res(SAMPLE), PERSONAS.generic).text();
        expect(out).not.toContain("data-persona");
        expect(out).toContain("OLD TAGLINE");
    });

    it("sets data-persona and swaps copy for a focused persona", async () => {
        const out = await applyPersonaToHtml(res(SAMPLE), PERSONAS.security).text();
        expect(out).toContain('data-persona="security"');
        expect(out).toContain(PERSONAS.security.tagline);
        expect(out).not.toContain("OLD TAGLINE");
        expect(out).not.toContain("OLD LEAD");
    });
});
