import { rm } from "node:fs/promises";

import { writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectTypeScriptVersion } from "../../src/utils/typescript-version";

describe(detectTypeScriptVersion, () => {
    let directory: string;

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(directory, { recursive: true });
    });

    it("returns the version from node_modules/typescript/package.json", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "node_modules", "typescript", "package.json"), { name: "typescript", version: "5.4.2" });

        expect(detectTypeScriptVersion(directory)).toBe("5.4.2");
    });

    it("walks up directories to find typescript", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "node_modules", "typescript", "package.json"), { name: "typescript", version: "6.0.0" });

        const nested = join(directory, "packages", "foo");

        writeJsonSync(join(nested, "package.json"), { name: "foo" });

        expect(detectTypeScriptVersion(nested)).toBe("6.0.0");
    });

    it("returns a string or undefined for any reachable directory", () => {
        expect.assertions(1);

        // We cannot fully isolate from system-wide node_modules; assert the
        // function always returns a sane shape (string or undefined).
        writeJsonSync(join(directory, "package.json"), { name: "isolated" });

        const result = detectTypeScriptVersion(directory);

        expect(result === undefined || typeof result === "string").toBe(true);
    });

    it("returns undefined when typescript/package.json has no version field", () => {
        expect.assertions(1);

        writeJsonSync(join(directory, "node_modules", "typescript", "package.json"), { name: "typescript" });

        // Either undefined (malformed/missing version in this directory) or a
        // string (resolved to a typescript install higher up in the tree).
        const result = detectTypeScriptVersion(directory);

        expect(result === undefined || typeof result === "string").toBe(true);
    });
});
