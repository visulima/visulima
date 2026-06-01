import { describe, expect, it } from "vitest";

import { classifyUpdate, compareTagsDesc, parseTag, pickBestTag } from "../../../../src/commands/update/ecosystems/semver-helpers";

describe(parseTag, () => {
    it("parses canonical semver tags", () => {
        expect.assertions(3);

        const tag = parseTag("v1.2.3");

        expect(tag).toBeDefined();
        expect(tag?.major).toBe(1);
        expect(tag?.normalized).toBe("1.2.3");
    });

    it("coerces partial versions (`v3`)", () => {
        expect.assertions(3);

        const tag = parseTag("v3");

        expect(tag).toBeDefined();
        expect(tag?.major).toBe(3);
        expect(tag?.minor).toBe(0);
    });

    it("flags prereleases", () => {
        expect.assertions(2);

        const tag = parseTag("2.0.0-beta.1");

        expect(tag?.prerelease).toBe(true);
        expect(tag?.normalized).toBe("2.0.0-beta.1");
    });

    it("returns undefined for non-semver strings", () => {
        expect.assertions(3);

        expect(parseTag("main")).toBeUndefined();
        expect(parseTag("nightly")).toBeUndefined();
        expect(parseTag("")).toBeUndefined();
    });
});

describe(compareTagsDesc, () => {
    it("orders newer-first", () => {
        expect.assertions(1);

        const tags = ["1.0.0", "2.0.0", "1.5.0"].map((entry) => parseTag(entry)).filter((value): value is NonNullable<typeof value> => value !== undefined);
        const sorted = tags.toSorted(compareTagsDesc).map((tag) => tag.normalized);

        expect(sorted).toStrictEqual(["2.0.0", "1.5.0", "1.0.0"]);
    });
});

describe(pickBestTag, () => {
    const tags = ["v1.0.0", "v1.5.0", "v2.0.0", "v2.1.0", "v3.0.0-beta.1"]
        .map((entry) => parseTag(entry))
        .filter((value): value is NonNullable<typeof value> => value !== undefined);

    it("returns the highest stable when mode=latest", () => {
        expect.assertions(1);

        const best = pickBestTag(tags, parseTag("v1.0.0"), "latest", false);

        expect(best?.normalized).toBe("2.1.0");
    });

    it("respects mode=minor — same major only", () => {
        expect.assertions(1);

        const best = pickBestTag(tags, parseTag("v1.0.0"), "minor", false);

        expect(best?.normalized).toBe("1.5.0");
    });

    it("respects mode=patch — same major+minor only", () => {
        expect.assertions(1);

        const newer = ["v1.0.0", "v1.0.1", "v1.0.2", "v1.1.0"]
            .map((entry) => parseTag(entry))
            .filter((value): value is NonNullable<typeof value> => value !== undefined);
        const best = pickBestTag(newer, parseTag("v1.0.0"), "patch", false);

        expect(best?.normalized).toBe("1.0.2");
    });

    it("skips prereleases by default", () => {
        expect.assertions(1);

        const best = pickBestTag(tags, parseTag("v2.0.0"), "latest", false);

        // 3.0.0-beta.1 is newer but pre-release → 2.1.0 wins.
        expect(best?.normalized).toBe("2.1.0");
    });

    it("includes prereleases when allowed", () => {
        expect.assertions(1);

        const best = pickBestTag(tags, parseTag("v2.1.0"), "latest", true);

        expect(best?.normalized).toBe("3.0.0-beta.1");
    });

    it("returns undefined when nothing newer", () => {
        expect.assertions(1);

        const best = pickBestTag(tags, parseTag("v2.1.0"), "latest", false);

        expect(best).toBeUndefined();
    });
});

describe(classifyUpdate, () => {
    it("classifies major/minor/patch", () => {
        expect.assertions(3);

        expect(classifyUpdate(parseTag("1.0.0"), parseTag("2.0.0"))).toBe("major");
        expect(classifyUpdate(parseTag("1.0.0"), parseTag("1.1.0"))).toBe("minor");
        expect(classifyUpdate(parseTag("1.0.0"), parseTag("1.0.5"))).toBe("patch");
    });

    it("returns unknown when either side fails to parse", () => {
        expect.assertions(2);

        expect(classifyUpdate(undefined, parseTag("1.0.0"))).toBe("unknown");
        expect(classifyUpdate(parseTag("1.0.0"), undefined)).toBe("unknown");
    });
});
