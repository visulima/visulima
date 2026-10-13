import { describe, expect, it } from "vitest";

import { isGemVersionRbPath } from "../../../src/release/core/orchestrator";

// The regex that isGemVersionRbPath replaces. Kept here only as the reference for the equivalence check.
const legacy = (path: string): boolean => /(?:^|\/)lib\/.+\/version\.rb$/.test(path);

describe(isGemVersionRbPath, () => {
    it.each([
        "lib/foo/version.rb",
        "lib/my_gem/version.rb",
        "packages/x/lib/foo/version.rb",
        "lib/a/b/version.rb",
        "ext/lib/gem/version.rb",
    ])("matches %s", (path) => {
        expect.assertions(1);

        expect(isGemVersionRbPath(path)).toBe(true);
    });

    it.each([
        "version.rb",
        "lib/version.rb",
        "src/foo/version.rb",
        "mylib/foo/version.rb",
        "lib/foo/version.rb.bak",
        "lib/foo/Version.rb",
        "lib/foo/version.rbx",
        "/lib/version.rb",
        "",
    ])("rejects %s", (path) => {
        expect.assertions(1);

        expect(isGemVersionRbPath(path)).toBe(false);
    });

    it("returns quickly on long adversarial input", () => {
        expect.assertions(1);

        const inputs = [
            `${"/lib/".repeat(50_000)}/version.rb`,
            `${"lib/".repeat(50_000)}version.rb`,
            `lib${"/".repeat(50_000)}version.rb`,
            `${"/lib".repeat(50_000)}/version.rbx`,
        ];

        const started = performance.now();

        for (const input of inputs) {
            isGemVersionRbPath(input);
        }

        expect(performance.now() - started).toBeLessThan(500);
    });

    it("agrees with the regex it replaces on generated paths", () => {
        expect.hasAssertions();

        const tokens = ["lib/", "/", "lib", "version.rb", "/version.rb", "x", "ver", "."];
        let seed = 42;
        const next = (): number => {
            seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;

            return seed / 2_147_483_648;
        };

        for (let i = 0; i < 5000; i++) {
            const length = 1 + Math.floor(next() * 8);
            let path = "";

            for (let j = 0; j < length; j++) {
                path += tokens[Math.floor(next() * tokens.length)] ?? "";
            }

            expect(isGemVersionRbPath(path), path).toBe(legacy(path));
        }
    });
});
