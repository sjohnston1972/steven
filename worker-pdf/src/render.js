// Applies the active persona to the PDF template HTML string. Generic returns
// it unchanged. A focused persona swaps the profile summary line and lifts its
// own skills row to the top of the Technical Skills list.
//
// The reordering is done to the markup itself rather than with CSS `order`
// (which is what the old two-column template did). Visual order and DOM order
// have to stay identical: an ATS reads the PDF text stream, which follows the
// document, so a CSS-only reshuffle would show the recruiter one order and
// hand the parser another.
//
// Pure string functions — no Workers globals — so they are easy to test.

const SKILLS_LIST = /(<ul class="skills">)([\s\S]*?)(<\/ul>)/;
const LIST_ITEM = /<li\b[\s\S]*?<\/li>/g;

// Moves the row tagged data-skill="<skill>" to the front of the skills list.
// No-op when the skill is absent or already first.
export function promoteSkillGroup(html, skill) {
    if (!skill) return html;
    const list = html.match(SKILLS_LIST);
    if (!list) return html;

    const items = list[2].match(LIST_ITEM) || [];
    const index = items.findIndex((li) => li.includes(`data-skill="${skill}"`));
    if (index <= 0) return html;

    const reordered = [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
    const body = `\n            ${reordered.join("\n            ")}\n        `;
    return html.replace(SKILLS_LIST, (_m, open, _inner, close) => open + body + close);
}

export function applyPersonaToTemplate(html, persona) {
    if (!persona || persona.id === "generic") return html;

    let out = html.replace("<body", `<body data-persona="${persona.id}"`);
    if (persona.aboutLead) {
        out = out.replace(
            /<span id="persona-summary">[\s\S]*?<\/span>/,
            () => `<span id="persona-summary">${persona.aboutLead}</span>`
        );
    }
    return promoteSkillGroup(out, persona.skill);
}
