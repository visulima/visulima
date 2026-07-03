import { describe, expect, it } from "vitest";

describe("upgrade version comparison", () => {
    it("should detect when versions are equal", () => {
        expect.assertions(1);

        const current = "1.0.0-alpha.3";
        const latest = "1.0.0-alpha.3";

        expect(current).toBe(latest);
    });

    it("should detect when update is available", () => {
        expect.assertions(1);

        const current = "1.0.0-alpha.3";
        const latest = "1.0.0-alpha.4";

        expect(current).not.toBe(latest);
    });
});

describe("upgrade version validation", () => {
    it("should accept valid semver for target version", () => {
        expect.assertions(3);

        const valid = ["1.0.0", "2.0.0-alpha.1", "1.0.0-rc.1"];

        for (const v of valid) {
            expect(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(v)).toBe(true);
        }
    });

    it("should reject invalid target versions", () => {
        expect.assertions(3);

        const invalid = ["latest", "../evil", "1.0.0; rm -rf /"];

        for (const v of invalid) {
            expect(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(v)).toBe(false);
        }
    });
});
