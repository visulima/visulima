import { describe, expect, it } from "vitest";

import Editors from "../editors";
import getLanguageImport, { LANGUAGE_IMPORT_MAP } from "../get-language-import";

describe("getLanguageImport", () => {
    it("returns undefined for unknown / invalid language names", async () => {
        await expect(getLanguageImport("not-a-language")).resolves.toBeUndefined();
        // @ts-expect-error testing runtime guard
        await expect(getLanguageImport(undefined)).resolves.toBeUndefined();
        await expect(getLanguageImport("")).resolves.toBeUndefined();
    });

    it("is case-insensitive", async () => {
        await expect(getLanguageImport("JavaScript")).resolves.toBeDefined();
    });

    it.each(["yaml", "toml", "python", "go", "rust", "ruby", "php", "graphql", "dockerfile", "json5"])(
        "exposes a polyglot importer for %s",
        (name) => {
            expect(typeof LANGUAGE_IMPORT_MAP[name]).toBe("function");
        },
    );
});

describe("Editors enum", () => {
    it("includes the newly added editors", () => {
        expect(Editors.windsurf).toBe("Windsurf");
        expect(Editors.fleet).toBe("JetBrains Fleet");
        expect(Editors.helix).toBe("Helix");
        expect(Editors.kiro).toBe("Kiro");
    });

    it("still includes the pre-existing editors", () => {
        expect(Editors.code).toBe("Visual Studio Code");
        expect(Editors.zed).toBe("Zed");
        expect(Editors.cursor).toBe("Cursor");
    });
});
