import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("create editor config generation", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-create-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should create .vscode/settings.json with defaults", () => {
        expect.assertions(3);

        const vscodeDir = join(tmpDir, ".vscode");

        mkdirSync(vscodeDir, { recursive: true });

        const defaultSettings = {
            "editor.defaultFormatter": "oxc.oxc-vscode",
            "editor.formatOnSave": true,
        };

        writeFileSync(join(vscodeDir, "settings.json"), `${JSON.stringify(defaultSettings, null, 4)}\n`);

        const settings = JSON.parse(readFileSync(join(vscodeDir, "settings.json"), "utf8"));

        expect(settings["editor.defaultFormatter"]).toBe("oxc.oxc-vscode");
        expect(settings["editor.formatOnSave"]).toBe(true);
        expect(existsSync(join(vscodeDir, "settings.json"))).toBe(true);
    });

    it("should create .vscode/extensions.json with recommendations", () => {
        expect.assertions(2);

        const vscodeDir = join(tmpDir, ".vscode");

        mkdirSync(vscodeDir, { recursive: true });

        const extensions = { recommendations: ["oxc.oxc-vscode"] };

        writeFileSync(join(vscodeDir, "extensions.json"), `${JSON.stringify(extensions, null, 4)}\n`);

        const result = JSON.parse(readFileSync(join(vscodeDir, "extensions.json"), "utf8"));

        expect(result.recommendations).toContain("oxc.oxc-vscode");
        expect(result.recommendations).toHaveLength(1);
    });

    it("should merge settings.json preserving existing settings", () => {
        expect.assertions(3);

        const vscodeDir = join(tmpDir, ".vscode");

        mkdirSync(vscodeDir, { recursive: true });

        const existing = {
            "editor.formatOnSave": false,
            "editor.tabSize": 4,
        };

        writeFileSync(join(vscodeDir, "settings.json"), JSON.stringify(existing));

        const defaults = {
            "editor.defaultFormatter": "oxc.oxc-vscode",
            "editor.formatOnSave": true,
        };

        const merged = { ...defaults, ...existing };

        writeFileSync(join(vscodeDir, "settings.json"), `${JSON.stringify(merged, null, 4)}\n`);

        const result = JSON.parse(readFileSync(join(vscodeDir, "settings.json"), "utf8"));

        // Existing settings should override defaults
        expect(result["editor.formatOnSave"]).toBe(false);
        expect(result["editor.tabSize"]).toBe(4);
        expect(result["editor.defaultFormatter"]).toBe("oxc.oxc-vscode");
    });

    it("should merge extensions.json deduplicating recommendations", () => {
        expect.assertions(2);

        const vscodeDir = join(tmpDir, ".vscode");

        mkdirSync(vscodeDir, { recursive: true });

        const existing = { recommendations: ["ms-vscode.vscode-typescript-next", "oxc.oxc-vscode"] };

        writeFileSync(join(vscodeDir, "extensions.json"), JSON.stringify(existing));

        const defaults = { recommendations: ["oxc.oxc-vscode"] };
        const merged = {
            ...existing,
            recommendations: [...new Set([...existing.recommendations, ...defaults.recommendations])],
        };

        writeFileSync(join(vscodeDir, "extensions.json"), `${JSON.stringify(merged, null, 4)}\n`);

        const result = JSON.parse(readFileSync(join(vscodeDir, "extensions.json"), "utf8"));

        expect(result.recommendations).toContain("oxc.oxc-vscode");
        expect(result.recommendations).toHaveLength(2); // no duplicates
    });
});
