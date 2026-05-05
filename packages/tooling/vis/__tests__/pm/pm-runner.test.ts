import { describe, expect, expectTypeOf, it } from "vitest";

import { detectPm, resolveInfo } from "../../src/pm/pm-runner";

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

        expect(() => detectPm(`/tmp/nonexistent-dir-${Date.now()}`)).toThrow(expect.anything());
    });
});

describe(resolveInfo, () => {
    it("should resolve to `npm view -- <pkg>` for npm", () => {
        expect.assertions(3);

        const { args, bin, warnings } = resolveInfo({ name: "npm", version: "10.0.0" }, { fields: [], json: false, package: "react" });

        expect(bin).toBe("npm");
        expect(args).toStrictEqual(["view", "--", "react"]);
        expect(warnings).toStrictEqual([]);
    });

    it("should resolve to `pnpm view -- <pkg> <field>` and pass through fields + --json", () => {
        expect.assertions(2);

        const { args, bin } = resolveInfo({ name: "pnpm", version: "10.0.0" }, { fields: ["version", "dependencies"], json: true, package: "react@18" });

        expect(bin).toBe("pnpm");
        expect(args).toStrictEqual(["view", "--", "react@18", "version", "dependencies", "--json"]);
    });

    it("should use `bun pm view` (not `bun view`) for bun", () => {
        expect.assertions(3);

        const { args, bin, warnings } = resolveInfo({ name: "bun", version: "1.3.0" }, { fields: ["version"], json: false, package: "react" });

        expect(bin).toBe("bun");
        expect(args).toStrictEqual(["pm", "view", "--", "react", "version"]);
        expect(warnings).toStrictEqual([]);
    });

    it("should warn when bun is older than 1.3 (pm view is unsupported)", () => {
        expect.assertions(2);

        const { args, warnings } = resolveInfo({ name: "bun", version: "1.2.5" }, { fields: [], json: false, package: "react" });

        expect(args).toStrictEqual(["pm", "view", "--", "react"]);
        expect(warnings).toHaveLength(1);
    });

    it("should not warn for bun when version is unknown (e.g. 'latest')", () => {
        expect.assertions(1);

        const { warnings } = resolveInfo({ name: "bun", version: "latest" }, { fields: [], json: false, package: "react" });

        expect(warnings).toStrictEqual([]);
    });

    it("should use `yarn info` for yarn v1 and accept a single field", () => {
        expect.assertions(3);

        const { args, bin, warnings } = resolveInfo({ name: "yarn", version: "1.22.19" }, { fields: ["version"], json: false, package: "react" });

        expect(bin).toBe("yarn");
        expect(args).toStrictEqual(["info", "--", "react", "version"]);
        expect(warnings).toStrictEqual([]);
    });

    it("should warn when yarn v1 is given multiple fields and keep only the first", () => {
        expect.assertions(2);

        const { args, warnings } = resolveInfo({ name: "yarn", version: "1.22.19" }, { fields: ["version", "dependencies"], json: false, package: "react" });

        expect(args).toStrictEqual(["info", "--", "react", "version"]);
        expect(warnings).toHaveLength(1);
    });

    it("should use `yarn npm info` for yarn berry and warn when fields are supplied", () => {
        expect.assertions(3);

        const { args, bin, warnings } = resolveInfo({ name: "yarn", version: "4.1.0" }, { fields: ["version"], json: true, package: "react" });

        expect(bin).toBe("yarn");
        expect(args).toStrictEqual(["npm", "info", "--", "react", "--json"]);
        expect(warnings).toHaveLength(1);
    });

    it("should not warn for yarn berry when no fields are supplied", () => {
        expect.assertions(2);

        const { args, warnings } = resolveInfo({ name: "yarn", version: "4.1.0" }, { fields: [], json: false, package: "react" });

        expect(args).toStrictEqual(["npm", "info", "--", "react"]);
        expect(warnings).toStrictEqual([]);
    });

    it("should safely forward a package name that looks like a flag by keeping it after `--`", () => {
        expect.assertions(1);

        const { args } = resolveInfo({ name: "npm", version: "10.0.0" }, { fields: [], json: false, package: "--registry=evil.com" });

        // `--` guarantees the tool treats the `--registry=…` token as a positional package name
        // (for which it will then report "not found"), not as a flag override.
        expect(args).toStrictEqual(["view", "--", "--registry=evil.com"]);
    });
});
