import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compareVersions, MIN_VIS_VERSION, warnIfVisTooOld } from "../src/server";

describe(compareVersions, () => {
    it("should order by major/minor/patch", () => {
        expect.assertions(3);

        expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
        expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
        expect(compareVersions("1.0.5", "1.0.5")).toBe(0);
    });

    it("should rank a stable release above its prerelease", () => {
        expect.assertions(2);

        expect(compareVersions("1.0.0", "1.0.0-alpha.1")).toBeGreaterThan(0);
        expect(compareVersions("1.0.0-alpha.1", "1.0.0")).toBeLessThan(0);
    });

    it("should order numeric prerelease identifiers numerically (alpha.9 < alpha.10)", () => {
        expect.assertions(2);

        expect(compareVersions("1.0.0-alpha.9", "1.0.0-alpha.10")).toBeLessThan(0);
        expect(compareVersions("1.0.0-alpha.35", "1.0.0-alpha.34")).toBeGreaterThan(0);
    });

    it("should treat an older alpha as below the required minimum", () => {
        expect.assertions(2);

        expect(compareVersions("1.0.0-alpha.20", MIN_VIS_VERSION)).toBeLessThan(0);
        expect(compareVersions(MIN_VIS_VERSION, MIN_VIS_VERSION)).toBe(0);
    });
});

describe(warnIfVisTooOld, () => {
    let stderrSpy: MockInstance<(typeof process.stderr)["write"]>;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        stderrSpy.mockRestore();
    });

    it("should warn to stderr when the resolved vis is older than the minimum", () => {
        expect.assertions(2);

        warnIfVisTooOld("1.0.0-alpha.20");

        const lines = stderrSpy.mock.calls.map((call) => String(call[0])).filter((message) => message.includes("older than the required"));

        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(MIN_VIS_VERSION);
    });

    it("should stay silent for a current or newer vis", () => {
        expect.assertions(1);

        warnIfVisTooOld(MIN_VIS_VERSION);
        warnIfVisTooOld("2.0.0");

        expect(stderrSpy.mock.calls.filter((call) => String(call[0]).includes("older than the required"))).toHaveLength(0);
    });

    it("should stay silent when the version is unknown (override path)", () => {
        expect.assertions(1);

        warnIfVisTooOld(undefined);

        expect(stderrSpy.mock.calls.filter((call) => String(call[0]).includes("older than the required"))).toHaveLength(0);
    });
});
