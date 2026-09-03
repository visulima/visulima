import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { describe, expect, it } from "vitest";

// The reason `compromise` is injected instead of imported: a static import anywhere in the
// default entry's module graph is unremovable by any bundler, and puts ~140 KB gzipped of
// English lexicon into every consumer — including the ones whose rules never touch NLP.
// These tests bundle the real source entries and assert on graph membership, so re-adding the
// import (directly, or through a helper that re-exports it) fails here rather than in someone's
// Cloudflare Workers deploy.
//
// This guards the SOURCE graph. `dist` is covered separately by packem's own build.
const bundleInputs = async (entry: string): Promise<string[]> => {
    const result = await build({
        bundle: true,
        // Resolved against this file, not the working directory, so the assertion does not
        // depend on where vitest was invoked from.
        entryPoints: [fileURLToPath(new URL(`../../src/${entry}`, import.meta.url))],
        format: "esm",
        metafile: true,
        minify: true,
        platform: "neutral",
        write: false,
    });

    return Object.keys(result.metafile.inputs);
};

const containsCompromise = (inputs: string[]): boolean => inputs.some((path) => path.includes("node_modules/compromise"));

describe("source module graph", () => {
    it("should keep the default entry free of the compromise lexicon", async () => {
        expect.assertions(1);

        expect(containsCompromise(await bundleInputs("index.ts"))).toBe(false);
    });

    it("should carry the compromise lexicon in the opt-in nlp entry", async () => {
        expect.assertions(1);

        // The counterpart to the assertion above: it proves the check can actually see
        // `compromise`, so the first test cannot pass because of a resolution mishap.
        expect(containsCompromise(await bundleInputs("nlp.ts"))).toBe(true);
    });
});
