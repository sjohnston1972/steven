import { handleChat } from "./chat.js";
import { handleAdmin } from "./admin.js";
import { applyPersonaToHtml } from "./render.js";
import { resolvePersona } from "./personas.js";

// Obscure, unlinked admin path.
const ADMIN_PATH = "/manage-7f3q9x";

// Read the active persona from KV, defaulting to generic on any failure.
// Only called for routes that actually need it (PDF, chat, HTML responses) so
// static assets don't each trigger a KV read.
async function getPersona(env) {
    let id = "generic";
    try {
        id = (await env.CHAT_KV.get("active_persona")) || "generic";
    } catch (_) { /* keep generic */ }
    return resolvePersona(id);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === ADMIN_PATH) {
            return handleAdmin(request, env, ADMIN_PATH);
        }

        if (url.pathname === "/Steven_Johnston_CV.pdf") {
            // Forward the active persona to the PDF service via an internal header.
            const persona = await getPersona(env);
            const h = new Headers(request.headers);
            h.set("X-Persona", persona.id);
            const pdfReq = new Request(request, { headers: h });
            return env.PDF.fetch(pdfReq);
        }

        if (url.pathname === "/api/chat") {
            const persona = await getPersona(env);
            return handleChat(request, env, ctx, persona);
        }

        const assetResponse = await env.ASSETS.fetch(request);

        // Only the HTML document is persona-transformed; other assets pass through
        // untouched (and without a KV read).
        const isHtml = (assetResponse.headers.get("Content-Type") || "").includes("text/html");
        if (isHtml) {
            const persona = await getPersona(env);
            return applyPersonaToHtml(assetResponse, persona);
        }
        return assetResponse;
    },
};
