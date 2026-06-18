/* ============================================================
   Steven Johnston — Portfolio JavaScript
   Network canvas animation + scroll behaviours
   ============================================================ */

// ── Network Canvas ───────────────────────────────────────────
(function () {
    const canvas  = document.getElementById('heroCanvas');
    if (!canvas) return;
    const ctx     = canvas.getContext('2d');
    const NODES   = 42;
    const MAX_D   = 190;
    const SPEED   = 0.28;
    const GOLD    = [200, 169, 106];
    const BLUE    = [107, 164, 248];

    let nodes = [], raf, paused = false;

    function resize() {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    function mkNode() {
        const useBlue = Math.random() < 0.18;
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * SPEED,
            vy: (Math.random() - 0.5) * SPEED,
            r: Math.random() * 1.8 + 0.8,
            c: useBlue ? BLUE : GOLD,
        };
    }

    function init() {
        nodes = Array.from({ length: NODES }, mkNode);
    }

    function isLight() { return document.body.classList.contains('light'); }

    function draw() {
        if (paused) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const light = isLight();
        const edgeAlpha   = light ? 0.18 : 0.30;
        const nodeAlpha   = light ? 0.45 : 0.65;

        // Move
        for (const n of nodes) {
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 0 || n.x > canvas.width)  n.vx *= -1;
            if (n.y < 0 || n.y > canvas.height)  n.vy *= -1;
        }

        // Edges
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d  = Math.sqrt(dx * dx + dy * dy);
                if (d < MAX_D) {
                    const a = (1 - d / MAX_D) * edgeAlpha;
                    const [r, g, b] = nodes[i].c;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }

        // Nodes
        for (const n of nodes) {
            const [r, g, b] = n.c;
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},${nodeAlpha})`;
            ctx.fill();
        }

        raf = requestAnimationFrame(draw);
    }

    // Pause animation when tab hidden (battery / perf)
    document.addEventListener('visibilitychange', () => {
        paused = document.hidden;
        if (!paused) draw();
    });

    window.addEventListener('resize', () => { resize(); init(); }, { passive: true });

    resize();
    init();
    draw();
}());

// ── Nav scroll ───────────────────────────────────────────────
(function () {
    const nav = document.getElementById('nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 48);
    }, { passive: true });
}());

// ── Hamburger ────────────────────────────────────────────────
(function () {
    const btn    = document.getElementById('navHamburger');
    const mobile = document.getElementById('navMobile');
    if (!btn || !mobile) return;

    const nav = document.getElementById('nav');

    btn.addEventListener('click', () => {
        const open = mobile.classList.toggle('open');
        btn.setAttribute('aria-expanded', open);
        nav.classList.toggle('menu-open', open);
    });

    // Close on link click
    mobile.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            mobile.classList.remove('open');
            nav.classList.remove('menu-open');
            btn.setAttribute('aria-expanded', false);
        });
    });
}());

// ── Scroll reveal ────────────────────────────────────────────
(function () {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    // For skill cards inside the grid, we want the grid wrapper itself
    // to orchestrate staggered children — mark individual cards too
    const skillGrid = document.querySelector('.skills-grid');
    if (skillGrid) {
        skillGrid.querySelectorAll('.skill-card').forEach(c => c.classList.add('reveal'));
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}());

// ── Light / Dark toggle ──────────────────────────────────────
(function () {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;

    // Light by default; restore a saved dark preference
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.remove('light');
    }

    btn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}());

// ── Smooth anchor offset (accounts for fixed nav) ────────────
(function () {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', e => {
            const id = link.getAttribute('href').slice(1);
            const target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            const navH = document.getElementById('nav')?.offsetHeight || 70;
            const y = target.getBoundingClientRect().top + window.scrollY - navH - 16;
            window.scrollTo({ top: y, behavior: 'smooth' });
        });
    });
}());
