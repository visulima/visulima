/**
 * Unit tests for the `vis.config.ts` scanner behind `vis release init`
 * (CodeRabbit F1 on PR #867).
 *
 * The scanner replaced a `/\brelease\s*:/` test. That regex fired on a
 * comment, on a string and on a nested key, and each false hit told the
 * migration "this repo already has a release config" — which is precisely the
 * claim `--cutover` deletes every `.releaserc.*` on. So the cases below are
 * split into "these must NOT count as a root release key" (the regex said they
 * did) and "these must".
 */

import { describe, expect, it } from "vitest";

import { scanVisConfigSource } from "../../../src/commands/release/init/vis-config-source";

/** The `hasReleaseKey` answer, asserting the scan located the object at all. */
const hasRelease = (source: string): boolean => {
    const scan = scanVisConfigSource(source);

    if (scan.kind !== "found") {
        throw new Error(`expected the config object to be found, got "${scan.kind}"`);
    }

    return scan.hasReleaseKey;
};

/** Wrap `body` in the canonical generated-config shape. */
const config = (body: string): string => `import { defineConfig } from "@visulima/vis/config";\n\nexport default defineConfig({\n${body}\n});\n`;

describe(scanVisConfigSource, () => {
    describe("a root `release` property", () => {
        it.each([
            ["a plain key", "    release: { baseBranch: \"main\" },"],
            ["a quoted key", "    \"release\": { baseBranch: \"main\" },"],
            ["a single-quoted key", "    'release': {},"],
            ["a shorthand property", "    release,"],
            ["a method", "    release() { return {}; },"],
            ["a key after another key", "    tasks: {},\n    release: {},"],
            ["a key on one line", "    tasks: {}, release: {},"],
        ])("detects %s", (_label, body) => {
            expect.hasAssertions();

            expect(hasRelease(config(body))).toBe(true);
        });

        it("detects it through an `export default {` anchor too", () => {
            expect.hasAssertions();

            expect(hasRelease("export default {\n    release: {},\n};\n")).toBe(true);
        });
    });

    describe("text that only looks like one", () => {
        it.each([
            ["a line comment", "    // release: { baseBranch: \"main\" } — TODO"],
            ["a trailing line comment", "    tasks: {}, // release: TODO"],
            ["a block comment", "    /* release: {} is not configured yet */"],
            ["a JSDoc block", "    /**\n     * release: wired up in phase 6.\n     */"],
            ["a string value", "    name: \"release: prod\","],
            ["a single-quoted string value", "    name: 'release: prod',"],
            ["a string with an escaped quote", String.raw`    name: "he said \"release:\" once",`],
            ["a template literal", "    name: `release: ${process.env.CHANNEL}`,"],
            ["a regular expression", "    match: /release:/,"],
            ["a nested key", "    tasks: {\n        release: { command: \"echo\" },\n    },"],
            ["a key nested in an array of objects", "    plugins: [{ release: true }],"],
            ["a key two objects deep", "    a: { b: { release: {} } },"],
            ["a spread of a `release` variable", "    ...release,"],
            ["a key inside a template interpolation", "    name: `${JSON.stringify({ release: 1 })}`,"],
        ])("ignores %s", (_label, body) => {
            expect.hasAssertions();

            expect(hasRelease(config(body))).toBe(false);
        });

        it("ignores a `release` key that only appears after the config object closes", () => {
            expect.hasAssertions();

            expect(hasRelease("export default defineConfig({\n    tasks: {},\n});\n\nconst other = { release: {} };\n")).toBe(false);
        });
    });

    describe("sources it refuses to guess at", () => {
        it("reports no anchor when the object is behind a variable", () => {
            expect.hasAssertions();

            expect(scanVisConfigSource("const config = { tasks: {} };\n\nexport default config;\n")).toStrictEqual({ kind: "no-anchor" });
        });

        it("reports an unterminated object when a brace is missing", () => {
            expect.hasAssertions();

            expect(scanVisConfigSource("export default defineConfig({\n    tasks: {},\n")).toStrictEqual({ kind: "unterminated" });
        });

        it("does not mistake a brace inside a comment for the object's end", () => {
            expect.hasAssertions();

            expect(hasRelease("export default defineConfig({\n    // }\n    release: {},\n});\n")).toBe(true);
        });
    });

    describe("bodyStart", () => {
        it("points just past the opening brace so the block splices in as the first property", () => {
            expect.hasAssertions();

            const source = "export default defineConfig({\n    tasks: {},\n});\n";
            const scan = scanVisConfigSource(source);

            if (scan.kind !== "found") {
                throw new Error("expected the config object to be found");
            }

            expect(source.slice(0, scan.bodyStart)).toBe("export default defineConfig({");
            expect(`${source.slice(0, scan.bodyStart)}\n    release: {},${source.slice(scan.bodyStart)}`).toBe(
                "export default defineConfig({\n    release: {},\n    tasks: {},\n});\n",
            );
        });

        it("prefers the `defineConfig(` anchor over a later `export default {`", () => {
            expect.hasAssertions();

            const source = "const base = defineConfig({ tasks: {} });\n\nexport default { ...base };\n";
            const scan = scanVisConfigSource(source);

            if (scan.kind !== "found") {
                throw new Error("expected the config object to be found");
            }

            expect(source.slice(0, scan.bodyStart)).toBe("const base = defineConfig({");
        });
    });
});
