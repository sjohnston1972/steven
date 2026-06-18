// Applies the active persona to the PDF template HTML string. Generic returns
// it unchanged. A focused persona tags <body data-persona="id"> (CSS in the
// template reorders the skill groups off that) and swaps the profile summary
// line. Pure string function — no Workers globals — so it is easy to reason about.
export function applyPersonaToTemplate(html, persona) {
    if (!persona || persona.id === "generic") return html;
    let out = html.replace("<body", `<body data-persona="${persona.id}"`);
    if (persona.aboutLead) {
        out = out.replace(
            /<span id="persona-summary">[\s\S]*?<\/span>/,
            `<span id="persona-summary">${persona.aboutLead}</span>`
        );
    }
    return out;
}
