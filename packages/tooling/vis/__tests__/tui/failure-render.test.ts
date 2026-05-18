import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { strip } from "@visulima/colorize";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderFailureOutput } from "../../src/tui/failure-render";

describe("tui/failure-render", () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "vis-fail-"));
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("returns raw output unchanged when there is no parseable stack", () => {
        expect.assertions(2);

        const raw = "npm ERR! something broke\nexit code 1\n";

        expect(renderFailureOutput(raw, { color: false, cwd: dir })).toBe(raw);
        expect(renderFailureOutput("", { color: false, cwd: dir })).toBe("");
    });

    it("renders a code frame for an on-disk frame and preserves the raw output", () => {
        expect.assertions(4);

        const file = join(dir, "app.js");

        writeFileSync(file, "const a = 1;\nconst b = 2;\nthrow new TypeError('boom');\nconst c = 3;\n");

        const raw = ["> vitest run", "", "TypeError: boom", `    at run (${file}:3:11)`, `    at main (${file}:1:1)`, ""].join("\n");

        const out = strip(renderFailureOutput(raw, { color: false, cwd: dir }));

        expect(out).toContain("✖ TypeError: boom");
        expect(out).toContain("app.js:3");
        // code frame includes the offending source line + the gutter pointer
        expect(out).toContain("throw new TypeError('boom');");
        // raw output is preserved verbatim beneath the rendered block
        expect(out).toContain("> vitest run");
    });

    it("resolves the original source through a source map", () => {
        expect.assertions(2);

        const generated = join(dir, "bundle.js");
        const map = {
            file: "bundle.js",
            mappings: ";AAAA",
            names: [],
            sources: ["original.ts"],
            sourcesContent: ["export const boom = (): never => {\n    throw new TypeError('from ts');\n};\n"],
            version: 3,
        };

        writeFileSync(generated, "\"use strict\";\nthrow new TypeError(\"from js\");\n//# sourceMappingURL=bundle.js.map\n");
        writeFileSync(`${generated}.map`, JSON.stringify(map));

        const raw = ["RuntimeError: from js", `    at boom (${generated}:2:1)`].join("\n");

        const out = strip(renderFailureOutput(raw, { color: false, cwd: dir }));

        expect(out).toContain("original.ts");
        expect(out).toContain("export const boom");
    });

    it("emits no ANSI escapes when color is disabled", () => {
        expect.assertions(1);

        const file = join(dir, "x.js");

        writeFileSync(file, "throw new Error('x');\n");

        const raw = ["Error: x", `    at x (${file}:1:7)`].join("\n");
        const out = renderFailureOutput(raw, { color: false, cwd: dir });

        // eslint-disable-next-line no-control-regex
        expect(/\[/.test(out)).toBe(false);
    });
});
