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

    it("extracts the stack even when the runner wrapped it in ANSI, preserving the raw bytes", () => {
        expect.assertions(3);

        const file = join(dir, "ansi.js");

        writeFileSync(file, "throw new TypeError('wrapped');\n");

        // Runner colorized the header + frame; extraction strips ANSI first.
        const esc = String.fromCodePoint(27);
        const raw = [`${esc}[31mTypeError: wrapped${esc}[39m`, `${esc}[2m    at run (${file}:1:7)${esc}[22m`].join("\n");

        const rendered = renderFailureOutput(raw, { color: false, cwd: dir });
        const out = strip(rendered);

        expect(out).toContain("✖ TypeError: wrapped");
        expect(out).toContain("ansi.js:1");
        // The original ANSI-coloured output is preserved verbatim below.
        expect(rendered).toContain(`${esc}[31mTypeError: wrapped${esc}[39m`);
    });

    it("falls back to the generated frame when the mapped original source is missing", () => {
        expect.assertions(2);

        const generated = join(dir, "nosrc.js");
        const map = {
            file: "nosrc.js",
            mappings: ";AAAA",
            names: [],
            // Points at a source with no embedded content and no file on disk.
            sources: ["does-not-exist.ts"],
            version: 3,
        };

        writeFileSync(generated, "\"use strict\";\nthrow new TypeError(\"gen only\");\n//# sourceMappingURL=nosrc.js.map\n");
        writeFileSync(`${generated}.map`, JSON.stringify(map));

        const raw = ["TypeError: gen only", `    at boom (${generated}:2:1)`].join("\n");
        const out = strip(renderFailureOutput(raw, { color: false, cwd: dir }));

        expect(out).toContain("nosrc.js:2");
        expect(out).toContain("throw new TypeError");
    });

    it("falls back to the generated source when the .map file is corrupt", () => {
        expect.assertions(2);

        const generated = join(dir, "badmap.js");

        writeFileSync(generated, "\"use strict\";\nthrow new RangeError(\"corrupt map\");\n//# sourceMappingURL=badmap.js.map\n");
        writeFileSync(`${generated}.map`, "{ not valid json");

        const raw = ["RangeError: corrupt map", `    at boom (${generated}:2:1)`].join("\n");
        const out = strip(renderFailureOutput(raw, { color: false, cwd: dir }));

        expect(out).toContain("✖ RangeError: corrupt map");
        expect(out).toContain("throw new RangeError");
    });

    it("renders header + stack but no code frame when every frame is in node_modules", () => {
        expect.assertions(3);

        const raw = [
            "Error: deep",
            "    at fn (/repo/node_modules/dep/index.js:10:3)",
            "    at node:internal/process/task_queues:95:5",
        ].join("\n");

        const out = strip(renderFailureOutput(raw, { color: false, cwd: dir }));

        expect(out).toContain("✖ Error: deep");
        expect(out).toContain("at fn");
        // No on-disk user frame → no source code frame is emitted.
        expect(out).not.toContain(`${"─".repeat(40)}\n    1`);
    });

    it("normalizes a file:// frame URL into an on-disk code frame", () => {
        expect.assertions(2);

        const file = join(dir, "url.js");

        writeFileSync(file, "const z = 0;\nthrow new Error('via file url');\n");

        const raw = ["Error: via file url", `    at run (file://${file}:2:7)`].join("\n");
        const out = strip(renderFailureOutput(raw, { color: false, cwd: dir }));

        expect(out).toContain("✖ Error: via file url");
        expect(out).toContain("throw new Error('via file url');");
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
