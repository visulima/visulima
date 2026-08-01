import { describe, expect, it } from "vitest";

import { inspect, registerStringTag } from "../../src";

describe("workerd runtime shape", () => {
    it("should run in a worker global scope rather than a browser or node one", () => {
        expect.assertions(3);

        expect("window" in globalThis).toBe(false);
        // `typeof` (not a bare reference) — `HTMLElement` is not merely
        // undefined on workerd, it is undeclared, so reading it throws.
        // eslint-disable-next-line vitest/prefer-expect-type-of
        expect(typeof HTMLElement).toBe("undefined");
        expect(Object.prototype.toString.call(globalThis)).toBe("[object ServiceWorkerGlobalScope]");
    });

    it("should not crash on the absent HTMLElement branch", () => {
        expect.assertions(2);

        // `internalInspect` guards its `instanceof HTMLElement` check with a
        // `typeof HTMLElement === "function"` test; without that guard every
        // non-plain object would throw a ReferenceError on workerd.
        class Widget {
            public id = "w1";
        }

        expect(() => inspect(new Widget())).not.toThrow();
        expect(inspect(new Widget())).toBe("Widget { id: 'w1' }");
    });

    it("should render globalThis without descending into the worker scope", () => {
        expect.assertions(1);

        // Node renders `{ [object globalThis] }`; on workerd the scope's
        // constructor name is prepended because `Object.prototype.toString`
        // reports `[object ServiceWorkerGlobalScope]` rather than `[object global]`.
        // Either way the guard in `inspectObject` stops the walk, so inspecting
        // the global scope never enumerates the whole runtime.
        expect(inspect(globalThis)).toBe("ServiceWorkerGlobalScope { [object globalThis] }");
    });

    it("should honour the node custom-inspect symbol on a non-browser runtime", () => {
        expect.assertions(2);

        const value = {
            [Symbol.for("nodejs.util.inspect.custom")]: () => "CUSTOM",
        };

        expect(inspect(value)).toBe("CUSTOM");
        expect(inspect(value, { customInspect: false })).toContain("Symbol(nodejs.util.inspect.custom)");
    });
});

describe("nodejs_compat Buffer shim", () => {
    it("should behave like node's Buffer for the properties the inspector reads", () => {
        expect.assertions(5);

        const buffer = Buffer.from([1, 2, 3]);

        expect(Buffer).toBeTypeOf("function");
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer).toBeInstanceOf(Buffer);
        // The shim, like node, keeps `Uint8Array` as the string tag — which is
        // exactly why `inspectTypedArray` special-cases `instanceof Buffer`.
        expect(buffer[Symbol.toStringTag]).toBe("Uint8Array");
        expect(Object.getPrototypeOf(Buffer.prototype)).toBe(Uint8Array.prototype);
    });

    it("should render every Buffer construction path", () => {
        expect.assertions(5);

        expect(inspect(Buffer.from("hi"))).toBe("Buffer[ 104, 105 ]");
        expect(inspect(Buffer.from([1, 2, 3, 4]).subarray(1, 3))).toBe("Buffer[ 2, 3 ]");
        expect(inspect(Buffer.alloc(2))).toBe("Buffer[ 0, 0 ]");
        expect(inspect(Buffer.concat([Buffer.from([1]), Buffer.from([2])]))).toBe("Buffer[ 1, 2 ]");
        expect(inspect(Buffer.from("aGk=", "base64"))).toBe("Buffer[ 104, 105 ]");
    });

    it("should still label a plain Uint8Array as Uint8Array", () => {
        expect.assertions(2);

        expect(inspect(new Uint8Array([104, 105]))).toBe("Uint8Array[ 104, 105 ]");
        expect(inspect(new TextEncoder().encode("hi"))).toBe("Uint8Array[ 104, 105 ]");
    });

    it("should cap a large Buffer via maxArrayLength", () => {
        expect.assertions(2);

        const large = Buffer.alloc(1000, 7);

        expect(inspect(large, { maxArrayLength: 3 })).toBe("Buffer[ 7, 7, 7, … 997 more ]");
        expect(() => inspect(large)).not.toThrow();
    });
});

describe("web platform values on workerd", () => {
    it("should render workers globals without throwing", () => {
        expect.assertions(8);

        // These have no own enumerable properties — everything lives on the
        // prototype as accessors — so they render as an empty tagged object
        // rather than expanding. They must at least never throw.
        expect(inspect(new Headers({ "content-type": "text/plain" }))).toBe("Headers [Headers] {}");
        expect(inspect(new URL("https://example.com/path?a=1"))).toBe("URL [URL] {}");
        expect(inspect(new URLSearchParams("a=1&b=2"))).toBe("URLSearchParams [URLSearchParams] {}");
        expect(inspect(new Request("https://example.com"))).toBe("Request [Request] {}");
        expect(inspect(new Response("body"))).toBe("Response [Response] {}");
        expect(inspect(new Blob(["hi"]))).toBe("Blob [Blob] {}");
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- a workerd global, not a node builtin
        expect(inspect(new ReadableStream())).toBe("ReadableStream [ReadableStream] {}");
        expect(inspect(new AbortController())).toBe("AbortController [AbortController] {}");
    });

    it("should let a consumer teach the inspector about a web platform type", () => {
        expect.assertions(2);

        // `registerStringTag` is the supported escape hatch for the above.
        const registered = registerStringTag("URL", (value) => `URL { ${(value as URL).href} }`);

        expect(registered).toBe(true);
        expect(inspect(new URL("https://example.com/path"))).toBe("URL { https://example.com/path }");
    });
});
