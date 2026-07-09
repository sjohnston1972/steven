// Client and internal-cache headers deliberately differ. The caches.default
// key encodes PDF_VERSION and the persona id, so the stored copy can live
// long — but the public URL (/Steven_Johnston_CV.pdf) never changes when the
// admin switches persona, so the browser (and any shared cache) must not
// reuse a response or it would serve the previous persona's PDF for up to a
// day. Pure functions so they are unit-testable without the Workers runtime.

const COMMON = {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'inline; filename="Steven_Johnston_CV.pdf"',
};

export function clientHeaders() {
    return { ...COMMON, "Cache-Control": "no-store" };
}

export function cacheHeaders() {
    return { ...COMMON, "Cache-Control": "public, max-age=86400" };
}
