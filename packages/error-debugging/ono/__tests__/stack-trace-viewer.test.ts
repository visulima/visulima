import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import stackTraceViewer from "../src/error-inspector/components/stack-trace-viewer";

describe(stackTraceViewer, () => {
    let temporaryDirectory: string;
    let tsFile: string;
    let txtFile: string;

    beforeAll(() => {
        temporaryDirectory = mkdtempSync(join(tmpdir(), "ono-stack-viewer-"));
        tsFile = join(temporaryDirectory, "app.ts");
        txtFile = join(temporaryDirectory, "notes.txt");

        writeFileSync(tsFile, "export const greet = (): string => \"hi <world> & \\\"friends\\\"\";\n");
        writeFileSync(txtFile, "plain text with <tags> & \"quotes\" 'here'\n");
    });

    const buildError = (): Error => {
        const error = new Error("Boom happened");

        error.name = "BoomError";
        error.stack = [
            "BoomError: Boom happened",
            `    at greet (file://${tsFile}:1:14)`,
            `    at readNotes (file://${txtFile}:1:1)`,
            "    at require (node:internal/modules/cjs/loader:1:1)",
            "    at libFn (/project/node_modules/some-lib/index.js:5:9)",
            "    at webpackStuff (/project/webpack/bootstrap.js:2:2)",
            "    at nativeThing (/some/native/binding.js:3:3)",
        ].join("\n");

        return error;
    };

    it("renders clickable shiki frames and a plain-text frame, plus grouped frame labels", async () => {
        expect.assertions(6);

        const { html, script } = await stackTraceViewer(buildError());

        // Plain-text frame is rendered without shiki and HTML-escaped.
        expect(html).toContain("<pre class=\"shiki\"><code>");
        expect(html).toContain("&lt;tags&gt;");

        // Grouped frame labels for the non-application frame types.
        expect(html).toContain("node_modules");
        expect(html).toContain("internal");

        // Clickable frame without an editor URL falls back to the editor-link button.
        expect(html).toContain("data-editor-link");
        expect(script).toContain("__EDITOR_SCHEMES__");
    });

    it("emits server open-in-editor buttons when an openInEditorUrl is given", async () => {
        expect.assertions(2);

        const { html } = await stackTraceViewer(buildError(), { openInEditorUrl: "/__open-in-editor" });

        expect(html).toContain("data-open-in-editor");
        expect(html).toContain("data-url=\"/__open-in-editor\"");
    });

    it("renders frames without file information using the default source placeholder", async () => {
        expect.assertions(1);

        const error = new Error("No frames");

        error.name = "EmptyError";
        error.stack = "EmptyError: No frames\n    at <anonymous>";

        const { html } = await stackTraceViewer(error);

        expect(html).toContain("Stack trace viewer");
    });

    it("groups consecutive same-type frames and labels each group", async () => {
        expect.assertions(5);

        const error = new Error("Grouped frames");

        error.name = "GroupError";
        error.stack = [
            "GroupError: Grouped frames",
            "    at app1 (/app/src/one.js:1:1)",
            "    at app2 (/app/src/two.js:2:2)",
            "    at req1 (node:internal/modules/a:1:1)",
            "    at req2 (node:internal/modules/b:2:2)",
            "    at lib1 (/project/node_modules/x/index.js:1:1)",
            "    at lib2 (/project/node_modules/y/index.js:2:2)",
            "    at wp1 (/project/webpack/a.js:1:1)",
            "    at wp2 (/project/webpack/b.js:2:2)",
            "    at nat1 (/some/native/a.js:1:1)",
            "    at nat2 (/some/native/b.js:2:2)",
        ].join("\n");

        const { html } = await stackTraceViewer(error);

        // Group toggle labels rendered for each consecutive same-type group.
        expect(html).toContain("Toggle visibility of application frames");
        expect(html).toContain("Toggle visibility of internal frames");
        expect(html).toContain("Toggle visibility of node_modules frames");
        expect(html).toContain("Toggle visibility of webpack frames");
        expect(html).toContain("Toggle visibility of native frames");
    });
});
