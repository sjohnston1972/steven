// Transforms the homepage HTML for the active persona using HTMLRewriter.
// Generic returns the response untouched. Focused personas set
// <body data-persona="id"> and swap the hero eyebrow/tagline + about lead copy.

class SetAttr {
    constructor(name, value) { this.name = name; this.value = value; }
    element(el) { el.setAttribute(this.name, this.value); }
}

class SetInner {
    constructor(html) { this.html = html; }
    element(el) { el.setInnerContent(this.html, { html: true }); }
}

export function applyPersonaToHtml(response, persona) {
    if (!persona || persona.id === "generic") return response;
    return new HTMLRewriter()
        .on("body", new SetAttr("data-persona", persona.id))
        .on(".hero-eyebrow", new SetInner(persona.eyebrow))
        .on(".hero-tagline", new SetInner(persona.tagline))
        .on(".about-lead", new SetInner(persona.aboutLead))
        .transform(response);
}
