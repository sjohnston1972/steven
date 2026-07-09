import { describe, it, expect } from "vitest";
import { clientHeaders, cacheHeaders } from "../src/headers.js";

describe("PDF response headers", () => {
    it("client response is never reusable across persona switches", () => {
        const h = clientHeaders();
        expect(h["Cache-Control"]).toBe("no-store");
    });

    it("client response keeps the inline PDF disposition", () => {
        const h = clientHeaders();
        expect(h["Content-Type"]).toBe("application/pdf");
        expect(h["Content-Disposition"]).toBe('inline; filename="Steven_Johnston_CV.pdf"');
    });

    it("internally cached copy keeps the long max-age", () => {
        const h = cacheHeaders();
        expect(h["Cache-Control"]).toBe("public, max-age=86400");
        expect(h["Content-Type"]).toBe("application/pdf");
        expect(h["Content-Disposition"]).toBe('inline; filename="Steven_Johnston_CV.pdf"');
    });
});
