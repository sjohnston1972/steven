/* ============================================================
   Steven Johnston — CV chatbot widget
   Talks to /api/chat (Cloudflare Workers AI)
   ============================================================ */

(function () {
    const API = "/api/chat";
    const MAX_INPUT = 600;
    const GREETING = "Hi — I can answer questions about Steven's experience, skills, and background. What would you like to know?";
    const CHIPS = [
        "What AI tools has he built?",
        "What's his security experience?",
        "Is Steven available for work?",
    ];

    const root = document.createElement("div");
    root.innerHTML = `
        <button id="chat-fab" aria-label="Chat about Steven" title="Chat about Steven">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
        </button>
        <div id="chat-panel" role="dialog" aria-label="Chat assistant">
            <div class="chat-head">
                <div>
                    <div class="chat-head-title">Ask about Steven</div>
                    <div class="chat-head-sub">AI assistant &middot; runs on Cloudflare Workers AI</div>
                </div>
                <button class="chat-close" aria-label="Close chat">&#10005;</button>
            </div>
            <div class="chat-msgs"></div>
            <div class="chat-chips"></div>
            <div class="chat-input-row">
                <input type="text" maxlength="${MAX_INPUT}" placeholder="Ask a question..." aria-label="Your question">
                <button class="chat-send" aria-label="Send">Send</button>
            </div>
        </div>`;
    document.body.appendChild(root);

    const fab = root.querySelector("#chat-fab");
    const panel = root.querySelector("#chat-panel");
    const msgsEl = root.querySelector(".chat-msgs");
    const chipsEl = root.querySelector(".chat-chips");
    const input = root.querySelector("input");
    const sendBtn = root.querySelector(".chat-send");

    const history = [];
    let busy = false;
    let greeted = false;

    function addMsg(cls, text) {
        const el = document.createElement("div");
        el.className = "chat-msg " + cls;
        el.textContent = text;
        msgsEl.appendChild(el);
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return el;
    }

    // Minimal markdown renderer for bot replies. Escapes HTML before any
    // formatting, so model output can never inject markup.
    function mdToHtml(text) {
        const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const inline = (s) => {
            s = esc(s);
            s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
            s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
            // Linkify in a single pass so emails are matched whole and never
            // re-detected as bare domains. Alternation order matters: email,
            // then full URL, then bare domain (any subdomain + curated TLDs, so
            // tools.clydeford.net and friends become links without a whitelist).
            s = s.replace(
                /([\w.+-]+@[\w-]+\.[A-Za-z]{2,})|(https?:\/\/[^\s<]+)|(\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|ai|app|co\.uk)\b[^\s<]*)/gi,
                (m, email, url, domain) => {
                    if (email) return `<a href="mailto:${email}">${email}</a>`;
                    const raw = url || domain;
                    const clean = raw.replace(/[.,:;!?)]+$/, "");
                    const rest = raw.slice(clean.length);
                    const href = url ? clean : `https://${clean}`;
                    return `<a href="${href}" target="_blank" rel="noopener">${clean}</a>${rest}`;
                });
            return s;
        };
        let html = "";
        let list = null;
        const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
        for (const line of text.split(/\r?\n/)) {
            const ul = /^\s*[-*•]\s+(.*)/.exec(line);
            const ol = /^\s*\d+[.)]\s+(.*)/.exec(line);
            if (ul || ol) {
                const want = ul ? "ul" : "ol";
                if (list !== want) { closeList(); html += `<${want}>`; list = want; }
                html += `<li>${inline((ul || ol)[1])}</li>`;
            } else {
                closeList();
                const h = /^\s*#{1,4}\s+(.*)/.exec(line);
                if (h) html += `<div class="chat-h">${inline(h[1])}</div>`;
                else if (line.trim() === "") html += `<div class="chat-gap"></div>`;
                else html += `<div>${inline(line)}</div>`;
            }
        }
        closeList();
        return html;
    }

    function renderChips() {
        chipsEl.innerHTML = "";
        CHIPS.forEach((q) => {
            const b = document.createElement("button");
            b.className = "chat-chip";
            b.textContent = q;
            b.addEventListener("click", () => send(q));
            chipsEl.appendChild(b);
        });
    }

    function toggle(open) {
        panel.classList.toggle("open", open);
        if (open) {
            if (!greeted) {
                greeted = true;
                addMsg("bot", GREETING);
                renderChips();
            }
            input.focus();
        }
    }

    fab.addEventListener("click", () => toggle(!panel.classList.contains("open")));
    root.querySelector(".chat-close").addEventListener("click", () => toggle(false));
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") toggle(false);
    });

    async function send(text) {
        const content = (text || input.value).trim().slice(0, MAX_INPUT);
        if (!content || busy) return;
        busy = true;
        sendBtn.disabled = true;
        input.value = "";
        chipsEl.innerHTML = "";

        addMsg("user", content);
        history.push({ role: "user", content });

        const botEl = addMsg("bot", "…");

        try {
            const res = await fetch(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: history.slice(-12) }),
            });

            if (!res.ok) {
                let msg = "Something went wrong — please try again in a moment.";
                try {
                    const err = await res.json();
                    if (err && err.message) msg = err.message;
                } catch (_) { /* keep default */ }
                botEl.remove();
                history.pop();
                addMsg("notice", msg);
                return;
            }

            // Parse the SSE stream from Workers AI
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let answer = "";
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") continue;
                    try {
                        const chunk = JSON.parse(data);
                        if (chunk.response) {
                            answer += chunk.response;
                            botEl.innerHTML = mdToHtml(answer);
                            msgsEl.scrollTop = msgsEl.scrollHeight;
                        }
                    } catch (_) { /* partial chunk, ignore */ }
                }
            }

            if (answer) {
                history.push({ role: "assistant", content: answer });
            } else {
                botEl.remove();
                history.pop();
                addMsg("notice", "No reply came back — please try again.");
            }
        } catch (_) {
            botEl.remove();
            history.pop();
            addMsg("notice", "Connection problem — please try again.");
        } finally {
            busy = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }

    sendBtn.addEventListener("click", () => send());
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") send();
    });
}());
