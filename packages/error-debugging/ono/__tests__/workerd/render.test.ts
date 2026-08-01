import { describe, expect, it } from "vitest";

import { renderAnsi, renderHtml, renderJson } from "../../src/index";

const withStack = (message: string, ...frames: string[]): Error => {
    const error = new Error(message);

    error.stack = [`Error: ${message}`, ...frames].join("\n");

    return error;
};

describe("`renderJson` on workerd", () => {
    it("should report `workerd` as the detected runtime", async () => {
        expect.assertions(1);

        const payload = await renderJson(new Error("boom"));

        expect(payload.runtime).toBe("workerd");
    });

    it("should parse workerd-shaped frames into the payload", async () => {
        expect.assertions(2);

        const payload = await renderJson(withStack("boom", "    at handler (index.js:5:11)", "    at fetch (worker.js:1:1)"));

        expect(payload.stack[0]?.frames.map((frame) => frame.file)).toStrictEqual(["index.js", "worker.js"]);
        expect(payload.stack[0]?.frames[0]).toStrictEqual({
            column: 11,
            file: "index.js",
            line: 5,
            methodName: "handler",
            raw: "at handler (index.js:5:11)",
            type: undefined,
        });
    });

    it("should include the full cause chain", async () => {
        expect.assertions(2);

        const payload = await renderJson(new Error("outer", { cause: new Error("inner") }));

        expect(payload.stack).toHaveLength(2);
        expect(payload.stack.map((entry) => entry.message)).toStrictEqual(["outer", "inner"]);
    });

    it("should coerce a thrown non-Error value", async () => {
        expect.assertions(2);

        const payload = await renderJson("string throw");

        expect(payload.stack[0]?.name).toBe("Error");
        expect(payload.stack[0]?.message).toBe("string throw");
    });

    it("should stay JSON-serialisable so it can be returned from a `fetch` handler", async () => {
        expect.assertions(1);

        const payload = await renderJson(new Error("boom", { cause: new TypeError("root") }));

        expect(() => Response.json(payload)).not.toThrow();
    });

    it("should not reject when a solution finder needs a source file it cannot read", async () => {
        expect.assertions(1);

        // Solution finders are handed the frame's source snippet; on workerd the read always fails.
        // That must degrade to an empty snippet, not a rejected promise.
        const payload = await renderJson(withStack("boom", "    at handler (/app/src/index.ts:5:11)"));

        expect(payload.stack).toHaveLength(1);
    });
});

describe("`renderHtml` on workerd", () => {
    it("should render a complete HTML document", async () => {
        expect.assertions(3);

        const html = await renderHtml(withStack("boom", "    at handler (index.js:5:11)"));

        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("</html>");
        expect(html).toContain("boom");
    });

    it("should neutralise markup in the error message even without DOMPurify", async () => {
        expect.assertions(2);

        // DOMPurify cannot run without a DOM, so the sanitizer falls back to HTML-entity escaping.
        // That is strictly stronger than sanitizing — no markup survives — so the page stays safe.
        const html = await renderHtml(withStack("<img src=x onerror=\"alert(1)\">", "    at handler (index.js:1:1)"));

        expect(html).not.toContain("<img src=x");
        expect(html).toContain("&lt;img src=x");
    });

    it("should report that no DOMPurify sanitizer resolved on this runtime", async () => {
        expect.assertions(1);

        // Pins the documented degradation: on workerd the escaping fallback is what runs.
        const { hasSanitizer } = await import("../../src/error-inspector/utils/dompurify");

        expect(hasSanitizer()).toBe(false);
    });

    it("should render a cause chain into the page", async () => {
        expect.assertions(2);

        const html = await renderHtml(new Error("outer", { cause: new Error("inner-cause-marker") }));

        expect(html).toContain("outer");
        expect(html).toContain("inner-cause-marker");
    });

    it("should render an AggregateError", async () => {
        expect.assertions(1);

        const html = await renderHtml(new AggregateError([new Error("a"), new Error("b")], "many failures"));

        expect(html).toContain("many failures");
    });

    it("should coerce a thrown non-Error value", async () => {
        expect.assertions(1);

        const html = await renderHtml({ not: "an error" });

        expect(html).toContain("<!DOCTYPE html>");
    });

    it("should reject an invalid `solutionFinders` option rather than rendering garbage", async () => {
        expect.assertions(1);

        await expect(renderHtml(new Error("boom"), { solutionFinders: "nope" as never })).rejects.toThrow(TypeError);
    });
});

describe("`renderAnsi` on workerd", () => {
    it("should render terminal output for an edge stack", async () => {
        expect.assertions(2);

        const { errorAnsi } = await renderAnsi(withStack("boom", "    at handler (index.js:5:11)"));

        expect(errorAnsi).toContain("boom");
        expect(errorAnsi).toContain("index.js");
    });

    it("should omit the code frame when the source cannot be read", async () => {
        expect.assertions(1);

        // No filesystem on the edge: the frame line is still rendered, the source excerpt is not.
        const { errorAnsi } = await renderAnsi(withStack("boom", "    at handler (/app/src/index.ts:5:11)"));

        expect(errorAnsi).toContain("/app/src/index.ts");
    });
});
