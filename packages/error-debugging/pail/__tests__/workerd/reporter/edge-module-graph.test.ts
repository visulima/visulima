import { describe, expect, it } from "vitest";

// @ts-expect-error -- Vite `?raw` import: inlines the file contents as a string at transform time.
import abstractHttpReporterSource from "../../../src/reporter/http/abstract-http-reporter.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import edgeLightSource from "../../../src/reporter/http/http-reporter.edge-light.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import httpReporterSource from "../../../src/reporter/http/http-reporter.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import compressionSource from "../../../src/reporter/http/utils/compression.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import logSizeErrorSource from "../../../src/reporter/http/utils/log-size-error.ts?raw";
// @ts-expect-error -- Vite `?raw` import.
import retrySource from "../../../src/reporter/http/utils/retry.ts?raw";
// @ts-expect-error -- Vite `?raw` import. Control sample: this module legitimately imports `node:process`.
import serverJsonReporterSource from "../../../src/reporter/json/json-reporter.server.ts?raw";

/**
 * Collects *static* `import`/`export ... "node:x"` declarations — the form that fails at
 * module-load time. `await import("node:x")` is deliberately not reported: a dynamic import
 * is only evaluated when the branch that needs it actually runs.
 * @param source The module source text.
 * @returns Every offending declaration, verbatim.
 */
const staticNodeImportsIn = (source: string): string[] =>
    source
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => (line.startsWith("import ") || line.startsWith("export ")) && !line.includes("import(") && (line.includes("\"node:") || line.includes("'node:")));

/**
 * The `edge-light` export condition promises this reporter loads on runtimes with no
 * Node builtins at all. A static `node:*` import anywhere in its own module graph breaks
 * that promise at *import* time, long before any log line is written — and it cannot be
 * caught by a runtime test on workerd, where `nodejs_compat` makes those imports resolve.
 */
describe("edge HTTP reporter module graph", () => {
    const modules: [string, string][] = [
        ["http-reporter.edge-light.ts", edgeLightSource as string],
        ["http-reporter.ts", httpReporterSource as string],
        ["abstract-http-reporter.ts", abstractHttpReporterSource as string],
        ["utils/compression.ts", compressionSource as string],
        ["utils/retry.ts", retrySource as string],
        ["utils/log-size-error.ts", logSizeErrorSource as string],
    ];

    it.each(modules)("%s declares no static node: import", (_name, source) => {
        expect.assertions(1);

        expect(staticNodeImportsIn(source)).toStrictEqual([]);
    });

    it("detects a static node: import when one is present", () => {
        expect.assertions(1);

        // Control sample — proves the checks above are not passing vacuously.
        expect(staticNodeImportsIn(serverJsonReporterSource as string)).toStrictEqual(["import { stderr, stdout } from \"node:process\";"]);
    });

    it("reaches node:zlib only through a dynamic import", () => {
        expect.assertions(2);

        expect(compressionSource as string).toContain("await import(\"node:zlib\")");
        expect(staticNodeImportsIn(compressionSource as string)).toStrictEqual([]);
    });

    it("measures payload size with TextEncoder rather than Buffer", () => {
        expect.assertions(2);

        expect(abstractHttpReporterSource as string).not.toContain("Buffer.byteLength");
        expect(abstractHttpReporterSource as string).toContain("new TextEncoder()");
    });
});
