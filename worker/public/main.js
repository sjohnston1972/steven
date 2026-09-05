/* Steven Johnston — site behaviour.
   Deliberately small: the only motion on this page answers something the
   visitor did. No scroll-triggered reveals, no ambient canvas. */

(function () {
    "use strict";

    /* ── Theme ──────────────────────────────────────────────────
       Defaults to the OS preference, then remembers a choice. */
    var body = document.body;
    var toggle = document.getElementById("themeToggle");

    function apply(theme) {
        body.classList.toggle("light", theme === "light");
        if (toggle) toggle.setAttribute("aria-label",
            theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    }

    var stored = null;
    try { stored = localStorage.getItem("theme"); } catch (e) { /* private mode */ }
    if (stored === "light" || stored === "dark") {
        apply(stored);
    } else {
        apply(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }

    if (toggle) {
        toggle.addEventListener("click", function () {
            var next = body.classList.contains("light") ? "dark" : "light";
            apply(next);
            try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
        });
    }

    /* ── Nav ────────────────────────────────────────────────────
       A hairline appears once the page has moved, so the bar reads as
       floating over content rather than being a permanent chrome band. */
    var nav = document.getElementById("nav");
    if (nav) {
        var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    var burger = document.getElementById("navBurger");
    var mobile = document.getElementById("navMobile");
    if (burger && mobile) {
        burger.addEventListener("click", function () {
            var open = mobile.classList.toggle("open");
            burger.setAttribute("aria-expanded", String(open));
            burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        });
        mobile.addEventListener("click", function (e) {
            if (e.target.tagName === "A") {
                mobile.classList.remove("open");
                burger.setAttribute("aria-expanded", "false");
            }
        });
    }

    /* ── The cutover switch ─────────────────────────────────────
       The one interactive idea on the page: it shows an estate as found and
       as built. Both panels exist in the markup, so with JS off the visitor
       still gets the "as built" copy rather than an empty box. */
    var cut = document.getElementById("cut");
    if (cut) {
        var buttons = cut.querySelectorAll(".cut-btn");
        var panels = cut.querySelectorAll(".cut-state");

        var show = function (state) {
            cut.setAttribute("data-state", state);
            buttons.forEach(function (b) {
                b.setAttribute("aria-pressed", String(b.getAttribute("data-state") === state));
            });
            panels.forEach(function (p) {
                var on = p.id === (state === "found" ? "cutFound" : "cutBuilt");
                p.classList.toggle("on", on);
                p.hidden = !on;
            });
        };

        buttons.forEach(function (b) {
            b.addEventListener("click", function () { show(b.getAttribute("data-state")); });
        });
    }
})();
