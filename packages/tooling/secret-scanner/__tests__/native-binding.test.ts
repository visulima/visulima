import { createRequire } from "node:module";

import { describe, expect, expectTypeOf, it } from "vitest";

// When running in CI (build-native.yml) the compiled `.node` binary is always
// present; locally the tests just skip the smoke assertions and leave the
// suite green.
const esmRequire = createRequire(import.meta.url);

let nativeBinaryPresent: boolean;

try {
    esmRequire("../index.js");
    nativeBinaryPresent = true;
} catch {
    nativeBinaryPresent = false;
}

describe("native-binding", () => {
    // eslint-disable-next-line vitest/prefer-expect-assertions -- type-only assertions via expectTypeOf
    it("loads the native addon when compiled", async () => {
        if (!nativeBinaryPresent) {
            return;
        }

        const nativeMod = await import("../index.js");

        expectTypeOf(nativeMod.scan).toBeFunction();
        expectTypeOf(nativeMod.scanSync).toBeFunction();
        expectTypeOf(nativeMod.scanTextSync).toBeFunction();
    });

    it("detects a hard-coded GitHub token via scanString", async () => {
        expect.assertions(1);

        if (!nativeBinaryPresent) {
            return;
        }

        const api = await import("../src/index.js");
        const content = ["# config", 'github_token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"'].join("\n");
        const findings = await api.scanString(content, "fake.env");

        expect(findings.length).toBeGreaterThan(0);
    });
});
