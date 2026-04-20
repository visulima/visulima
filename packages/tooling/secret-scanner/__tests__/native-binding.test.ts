import { describe, expect, expectTypeOf, it } from "vitest";

import { scan, scanSync, scanTextSync } from "../index.js";
import { scanString } from "../src/index";

describe("native-binding", () => {
    // eslint-disable-next-line vitest/prefer-expect-assertions -- type-only assertions via expectTypeOf
    it("loads the native addon when compiled", () => {
        expectTypeOf(scan).toBeFunction();
        expectTypeOf(scanSync).toBeFunction();
        expectTypeOf(scanTextSync).toBeFunction();
    });

    it("detects a hard-coded GitHub token via scanString", { timeout: 30_000 }, async () => {
        expect.assertions(1);

        const content = ["# config", 'github_token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"'].join("\n");
        const findings = await scanString(content, "fake.env");

        expect(findings.length).toBeGreaterThan(0);
    });
});
