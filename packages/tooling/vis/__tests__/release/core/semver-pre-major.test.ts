import { describe, expect, it } from "vitest";

import { bumpVersion } from "../../../src/release/core/semver";

/**
 * Coverage for the pre-1.0 demotion path. Matches release-please's
 * `bump-minor-pre-major` / `bump-patch-for-minor-pre-major` flags — a
 * common ask for 0.x libraries that don't want their first breaking
 * change to leap straight to 2.0.
 */

describe("bumpVersion: bumpMinorPreMajor", () => {
    it("demotes a major bump to minor when current.major === 0", () => {
        expect(bumpVersion({ bump: "major", bumpMinorPreMajor: true, current: "0.5.2" })).toBe("0.6.0");
    });

    it("leaves minor bumps alone unless `bumpPatchForMinorPreMajor` is also set", () => {
        expect(bumpVersion({ bump: "minor", bumpMinorPreMajor: true, current: "0.5.2" })).toBe("0.6.0");
    });

    it("demotes minor bumps to patch when both flags are set", () => {
        expect(
            bumpVersion({
                bump: "minor",
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                current: "0.5.2",
            }),
        ).toBe("0.5.3");
    });

    it("leaves patch bumps alone", () => {
        expect(
            bumpVersion({
                bump: "patch",
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                current: "0.5.2",
            }),
        ).toBe("0.5.3");
    });

    it("is a NO-OP once current.major >= 1 (pre-major demotion only applies to 0.x)", () => {
        expect(bumpVersion({ bump: "major", bumpMinorPreMajor: true, current: "1.0.0" })).toBe("2.0.0");
        expect(bumpVersion({ bump: "major", bumpMinorPreMajor: true, current: "12.5.7" })).toBe("13.0.0");
    });

    it("composes with prerelease channels (major bump on 0.x alpha → minor + .0)", () => {
        expect(
            bumpVersion({
                bump: "major",
                bumpMinorPreMajor: true,
                current: "0.5.2",
                prerelease: "alpha",
            }),
        ).toBe("0.6.0-alpha.0");
    });
});
