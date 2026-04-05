import { describe, expect, it } from "vitest";

import { detectPm } from "../src/pm-runner";

describe("detectPm", () => {
    it("should detect a valid package manager for the workspace", () => {
        expect.assertions(2);

        const pm = detectPm(process.cwd());

        expect(["pnpm", "npm", "yarn", "bun"]).toContain(pm.name);
        expect(typeof pm.version).toBe("string");
    });

    it("should detect pnpm for this monorepo", () => {
        expect.assertions(1);

        const pm = detectPm(process.cwd());

        expect(pm.name).toBe("pnpm");
    });

    it("should throw for non-existent directories", () => {
        expect.assertions(1);

        expect(() => detectPm("/tmp/nonexistent-dir-" + Date.now())).toThrow();
    });
});
