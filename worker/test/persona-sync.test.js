import { describe, it, expect } from "vitest";
import * as workerPersonas from "../src/personas.js";
import * as pdfPersonas from "../../worker-pdf/src/personas.js";

// worker-pdf cannot import across the wrangler project boundary, so its
// personas.js is a manual copy of worker's. This guard fails the suite when
// the two drift, which would make the site and the downloadable PDF disagree.
const SYNC_HINT =
    "worker-pdf/src/personas.js must be kept in sync with worker/src/personas.js — copy the canonical file over (keeping the sync-note header) and re-run.";

describe("persona definitions stay in sync across projects", () => {
    it("PERSONAS are deep-equal", () => {
        expect(pdfPersonas.PERSONAS, SYNC_HINT).toEqual(workerPersonas.PERSONAS);
    });

    it("DEFAULT_PERSONA matches", () => {
        expect(pdfPersonas.DEFAULT_PERSONA, SYNC_HINT).toEqual(workerPersonas.DEFAULT_PERSONA);
    });

    it("resolvePersona agrees on known and unknown ids", () => {
        for (const id of [...Object.keys(workerPersonas.PERSONAS), "bogus", null]) {
            expect(pdfPersonas.resolvePersona(id), SYNC_HINT).toEqual(workerPersonas.resolvePersona(id));
        }
    });
});
