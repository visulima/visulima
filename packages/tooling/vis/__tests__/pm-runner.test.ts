import { describe, expect, expectTypeOf, it } from "vitest";

import { detectPm } from "../src/pm-runner";

describe(detectPm, () => {
    it("should detect a valid package manager for the workspace", () => {
        // `expectTypeOf` is compile-time only; only `expect()` counts toward assertion totals.
        expect.assertions(1);

        const pm = detectPm(process.cwd());

        expect(["pnpm", "npm", "yarn", "bun"]).toContain(pm.name);

        expectTypeOf(pm.version).toBeString();
    });

    it("should detect pnpm for this monorepo", () => {
        expect.assertions(1);

        const pm = detectPm(process.cwd());

        expect(pm.name).toBe("pnpm");
    });

    it("should throw for non-existent directories", () => {
        expect.assertions(1);

        expect(() => detectPm(`/tmp/nonexistent-dir-${Date.now()}`)).toThrow();
    });
});
