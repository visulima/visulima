// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ViteDevServer } from "vite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getTailwindConfig } from "../../../src/rpc/functions/tailwind-config";

const makeServer = (root: string): ViteDevServer => ({ config: { root } }) as unknown as ViteDevServer;

describe("rpc/functions/tailwind-config", () => {
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vdt-tw-test-"));
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { force: true, recursive: true });
    });

    describe(getTailwindConfig, () => {
        it("reads the default theme and reports v4 when tailwindcss is installed (no v3 config)", async () => {
            // tailwindcss is a dev dependency of this package, so its theme.css resolves
            // and the default theme is non-empty, which promotes version to "v4".
            expect.assertions(3);

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.version).toBe("v4");
            expect(Object.keys(result.defaultTheme).length).toBeGreaterThan(0);
            expect(result.cssFiles).toEqual([]);
        });

        it("detects tailwind v3 via tailwind.config.* in root", async () => {
            expect.assertions(1);

            await fs.writeFile(path.join(tmpDir, "tailwind.config.cjs"), "module.exports = {};");

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.version).toBe("v3");
        });

        it("discovers css files that @import tailwindcss (double quotes)", async () => {
            expect.assertions(2);

            await fs.writeFile(path.join(tmpDir, "app.css"), "@import \"tailwindcss\";\n");

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.cssFiles).toContain("app.css");
            // No tailwind.config.* present, so version is either unknown or v4 (if installed) — never v3.
            expect(result.version).not.toBe("v3");
        });

        it("discovers css files that @import tailwindcss (single quotes)", async () => {
            expect.assertions(1);

            await fs.writeFile(path.join(tmpDir, "main.css"), "@import 'tailwindcss';\n");

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.cssFiles).toContain("main.css");
        });

        it("ignores css files without a tailwindcss @import", async () => {
            expect.assertions(1);

            await fs.writeFile(path.join(tmpDir, "plain.css"), ".foo { color: red; }\n");

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.cssFiles).not.toContain("plain.css");
        });

        it("skips node_modules, .git and dist directories while walking", async () => {
            expect.assertions(2);

            for (const directory of ["node_modules", ".git", "dist"]) {
                // eslint-disable-next-line no-await-in-loop
                await fs.mkdir(path.join(tmpDir, directory), { recursive: true });
                // eslint-disable-next-line no-await-in-loop
                await fs.writeFile(path.join(tmpDir, directory, "x.css"), "@import \"tailwindcss\";\n");
            }

            await fs.writeFile(path.join(tmpDir, "real.css"), "@import \"tailwindcss\";\n");

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.cssFiles).toContain("real.css");
            expect(result.cssFiles).toHaveLength(1);
        });

        it("extracts user @theme overrides while ignoring @theme default blocks", async () => {
            expect.assertions(3);

            const css = [
                "@import \"tailwindcss\";",
                "/* a comment with --not-a-var: nope; */",
                "@theme default {",
                "  --color-default: #000;",
                "}",
                "@theme {",
                "  --color-brand: #7c3aed;",
                "  --font-display:",
                "    'Inter',",
                "    sans-serif;",
                "}",
            ].join("\n");

            await fs.writeFile(path.join(tmpDir, "theme.css"), css);

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.customTheme["--color-brand"]).toBe("#7c3aed");
            // Multi-line value gets whitespace-collapsed to a single space.
            expect(result.customTheme["--font-display"]).toBe("'Inter', sans-serif");
            // The @theme default block is stripped before parsing user overrides.
            expect(result.customTheme["--color-default"]).toBeUndefined();
        });

        it("keeps the first occurrence of a duplicated theme variable", async () => {
            expect.assertions(1);

            const css = ["@import \"tailwindcss\";", "@theme {", "  --color-x: first;", "  --color-x: second;", "}"].join("\n");

            await fs.writeFile(path.join(tmpDir, "dup.css"), css);

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.customTheme["--color-x"]).toBe("first");
        });

        it("returns the css file path relative to root", async () => {
            expect.assertions(1);

            await fs.mkdir(path.join(tmpDir, "src", "styles"), { recursive: true });
            await fs.writeFile(path.join(tmpDir, "src", "styles", "index.css"), "@import \"tailwindcss\";\n");

            const result = await getTailwindConfig(makeServer(tmpDir));

            expect(result.cssFiles).toContain(path.join("src", "styles", "index.css"));
        });
    });
});
