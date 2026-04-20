import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scan, scanString } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));

describe("detector (integration)", () => {
    it("scans the fixture directory and reports findings", async () => {
        expect.assertions(3);

        const findings = await scan([resolve(here, "__fixtures__")]);

        expect(Array.isArray(findings)).toBe(true);
        expect(findings.length).toBeGreaterThan(0);

        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.size).toBeGreaterThan(0);
    });

    it("redact mode masks the secret", async () => {
        expect.assertions(1);

        const content = 'github_token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"';
        const findings = await scanString(content, "fake.env", { redact: true });

        for (const f of findings) {
            expect(f.secret).toMatch(/\*/);
        }
    });
});
