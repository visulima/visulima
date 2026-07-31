import { describe, expect, it } from "vitest";

/**
 * The single most important property on the edge: importing the package must not throw.
 *
 * Every public entry point is pulled in dynamically inside the assertion so a module-evaluation
 * failure surfaces as a failing expectation rather than a collection-time crash that hides which
 * entry point broke.
 */
describe("`@visulima/ono` import safety on workerd", () => {
    it("should run inside workerd", () => {
        expect.assertions(1);

        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- workerd always provides `navigator`
        expect(navigator.userAgent).toBe("Cloudflare-Workers");
    });

    it("should import the root entry point without throwing", async () => {
        expect.assertions(1);

        await expect(import("../../src/index")).resolves.toBeDefined();
    });

    it("should expose the documented root API", async () => {
        expect.assertions(1);

        const module = await import("../../src/index");

        expect(Object.keys(module).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["Ono", "renderAnsi", "renderHtml", "renderJson"]);
    });

    it("should import the `./page/context` sub-path without throwing", async () => {
        expect.assertions(1);

        // This one is the canary for DOM-less runtimes: it reaches the sanitizer, which is backed by
        // DOMPurify and used to blow up at module scope when there was no `window.document`.
        await expect(import("../../src/error-inspector/page/create-request-context")).resolves.toBeDefined();
    });

    it("should import the HTML template and its sanitizer without throwing", async () => {
        expect.assertions(3);

        await expect(import("../../src/error-inspector/index")).resolves.toBeDefined();
        await expect(import("../../src/error-inspector/layout")).resolves.toBeDefined();
        await expect(import("../../src/error-inspector/utils/sanitize")).resolves.toBeDefined();
    });

    it("should keep `node:http` off every runtime import path", async () => {
        expect.assertions(2);

        // `node:http` appears only in `import type` positions (request/response typings), which are
        // erased at build time. A value import would be unusable here — workerd has no HTTP server.
        await expect(import("../../src/error-inspector/page/types")).resolves.toBeDefined();

        const { runtime } = await import("../../src/error-inspector/page/types");

        expect(runtime.hasNativeRequest).toBe(true);
    });

    it("should keep the filesystem-backed editor middleware off the root entry point", async () => {
        expect.assertions(1);

        // `./server/open-in-editor` shells out to a local editor via `node:fs`; it is a separate
        // sub-path export precisely so an edge bundle never pulls it in.
        const module = await import("../../src/index");

        expect("createOpenInEditorMiddleware" in module).toBe(false);
    });
});
