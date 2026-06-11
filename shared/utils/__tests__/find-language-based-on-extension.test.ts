import { describe, expect, it } from "vitest";

import findLanguageBasedOnExtension from "../find-language-based-on-extension";

describe("findLanguageBasedOnExtension", () => {
    it.each([
        ["index.js", "javascript"],
        ["index.cjs", "javascript"],
        ["index.mjs", "javascript"],
        ["index.ts", "typescript"],
        ["index.cts", "typescript"],
        ["index.mts", "typescript"],
        ["component.tsx", "tsx"],
        ["component.jsx", "jsx"],
        ["data.json", "json"],
        ["data.json5", "json5"],
        ["config.jsonc", "jsonc"],
        ["doc.md", "markdown"],
        ["doc.mdoc", "markdown"],
        ["doc.mdx", "mdx"],
    ])("maps %s to %s", (file, expected) => {
        expect(findLanguageBasedOnExtension(file)).toBe(expected);
    });

    it.each([
        ["config.yaml", "yaml"],
        ["config.yml", "yaml"],
        ["config.toml", "toml"],
        ["main.py", "python"],
        ["main.go", "go"],
        ["main.rs", "rust"],
        ["main.rb", "ruby"],
        ["index.php", "php"],
        ["schema.graphql", "graphql"],
        ["query.gql", "graphql"],
        ["Dockerfile.dockerfile", "dockerfile"],
        ["script.sh", "bash"],
    ])("maps polyglot extension %s to %s", (file, expected) => {
        expect(findLanguageBasedOnExtension(file)).toBe(expected);
    });

    it("strips query strings before resolving the extension", () => {
        expect(findLanguageBasedOnExtension("/app/index.ts?v=123")).toBe("typescript");
    });

    it("falls back to text for unknown extensions instead of javascript", () => {
        expect(findLanguageBasedOnExtension("/app/binary.wat")).toBe("text");
        expect(findLanguageBasedOnExtension("/app/file.unknownext")).toBe("text");
    });

    it("falls back to text when there is no extension", () => {
        expect(findLanguageBasedOnExtension("Makefile")).toBe("text");
        expect(findLanguageBasedOnExtension("")).toBe("text");
    });
});
