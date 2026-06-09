import { describe, expect, it } from "vitest";

import { randomAnimalSlug, randomTimestampSlug } from "../../../src/release/core/slug";

const SLUG_RE = /^[a-z]+-[a-z]+$/;

describe(randomAnimalSlug, () => {
    it("emits two hyphen-joined alpha words", () => {
        for (let i = 0; i < 50; i += 1) {
            const slug = randomAnimalSlug();

            expect(slug).toMatch(SLUG_RE);
        }
    });

    it("varies across calls (probabilistic)", () => {
        const slugs = new Set<string>();

        for (let i = 0; i < 100; i += 1) {
            slugs.add(randomAnimalSlug());
        }

        // 100 picks of (40 × 40) word pairs should produce >5 distinct
        // slugs unless RNG is broken.
        expect(slugs.size).toBeGreaterThan(5);
    });
});

describe(randomTimestampSlug, () => {
    it("starts with the supplied prefix", () => {
        const slug = randomTimestampSlug("plan");

        expect(slug.startsWith("plan-")).toBe(true);
    });

    it("includes a base36 timestamp + 4-char hex tail", () => {
        const slug = randomTimestampSlug("override");
        const match = /^override-[a-z0-9]+-[a-z0-9]{4}$/.exec(slug);

        expect(match).not.toBeNull();
    });

    it("produces unique outputs for back-to-back calls", () => {
        const a = randomTimestampSlug("p");
        const b = randomTimestampSlug("p");

        expect(a).not.toBe(b);
    });
});
