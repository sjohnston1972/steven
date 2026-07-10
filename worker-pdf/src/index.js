import puppeteer from "@cloudflare/puppeteer";
import templateHtml from "./template.html";
import { resolvePersona } from "./personas.js";
import { applyPersonaToTemplate } from "./render.js";
import { clientHeaders, cacheHeaders } from "./headers.js";

// Bump to invalidate the cached PDF after editing template.html
const PDF_VERSION = "9";

export default {
    async fetch(request, env, ctx) {
        const cache = caches.default;
        const debug = new URL(request.url).searchParams.has("debug");

        const personaId = request.headers.get("X-Persona")
            || new URL(request.url).searchParams.get("persona")
            || "generic";
        const persona = resolvePersona(personaId);

        const cacheKey = new Request(`https://steven-cv-pdf.internal/Steven_Johnston_CV-${PDF_VERSION}-${persona.id}.pdf`);

        if (!debug) {
            const cached = await cache.match(cacheKey);
            // Serve the cached body but swap in the client headers — the
            // stored copy carries the long max-age needed for retention.
            if (cached) return new Response(cached.body, { headers: clientHeaders() });
        }

        const browser = await puppeteer.launch(env.BROWSER);
        let pdf;
        try {
            const page = await browser.newPage();
            const html = applyPersonaToTemplate(templateHtml, persona);
            await page.setContent(html, { waitUntil: "networkidle0" });
            if (debug) {
                await page.setViewport({ width: 794, height: 1123 });
                const shot = await page.screenshot({ fullPage: true });
                await browser.close();
                return new Response(shot, { headers: { "Content-Type": "image/png" } });
            }
            pdf = await page.pdf({
                format: "a4",
                printBackground: true,
                preferCSSPageSize: true,
            });
        } finally {
            await browser.close();
        }

        ctx.waitUntil(cache.put(cacheKey, new Response(pdf, { headers: cacheHeaders() })));
        return new Response(pdf, { headers: clientHeaders() });
    },
};
