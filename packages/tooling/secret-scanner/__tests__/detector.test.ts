import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

// These tests are skipped when the native binary isn't compiled. Build locally
// with `pnpm build:native` first to exercise them end-to-end.
const nativePath = resolve(here, "..", "index.js");

const loadNative = async (): Promise<typeof import("../index.js") | undefined> => {
    try {
        return await import(nativePath);
    } catch {
        return undefined;
    }
};

describe("detector (integration)", () => {
    it("scans the fixture directory and reports findings", async () => {
        expect.assertions(3);

        const native = await loadNative();

        if (!native) return;

        const configToml = await readFile(resolve(here, "..", "assets", "gitleaks.toml"), "utf8");
        const findings = await native.scan([resolve(here, "__fixtures__")], { configToml });

        expect(Array.isArray(findings)).toBe(true);
        expect(findings.length).toBeGreaterThan(0);

        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.size).toBeGreaterThan(0);
    });

    it("redact mode masks the secret", async () => {
        expect.assertions(1);

        const native = await loadNative();

        if (!native) return;

        const configToml = await readFile(resolve(here, "..", "assets", "gitleaks.toml"), "utf8");
        const content = 'github_token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"';
        const findings = native.scanTextSync(content, "fake.env", {
            configToml,
            redact: true,
        });

        for (const f of findings) {
            expect(f.secret).toMatch(/\*/);
        }
    });
});
