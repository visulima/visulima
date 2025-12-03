import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import capturedErrors from "../../__fixtures__/captured-errors";
import { VisulimaError } from "../../src";
import parseStacktrace from "../../src/stacktrace/parse-stacktrace";

const isWin = process.platform === "win32";

describe("parse-stacktrace", () => {
    describe("chromium", () => {
        it("should parse Chrome error with no location", () => {
            expect.assertions(2);

            const stackFrames = parseStacktrace({ stack: "Error\n at Array.forEach (native)" } as unknown as Error);

            expect(stackFrames).toHaveLength(1);
            expect(stackFrames[0]).toMatchStackFrame(["Array.forEach", "native", undefined, undefined, "native"]);
        });

        it("should match debugger stack trace", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace({
                // eslint-disable-next-line no-useless-concat
                stack: "Error: fail\n" + "    at foo (<anonymous>:1:33)\n" + "    at bar (<anonymous>:1:19)\n" + "    at <anonymous>:1:13\n",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["foo", "<anonymous>", 1, 33]);
            expect(stackFrames[1]).toMatchStackFrame(["bar", "<anonymous>", 1, 19]);
            expect(stackFrames[2]).toMatchStackFrame(["<unknown>", "<anonymous>", 1, 13]);
        });

        it("should patch name with <> characters", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace({
                // eslint-disable-next-line no-useless-concat
                stack: "Error\n" + "  at UserContext.<anonymous> (./tests/dom.test.js:23:3 <- ./tests/dom.test.js:435:1307)\n" + "  at <Jasmine>",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["UserContext.<anonymous>", "./tests/dom.test.js", 23, 3]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "<Jasmine>", undefined, undefined]);
        });

        it("should parse errors with custom schemes", () => {
            expect.assertions(2);

            const stackFrames = parseStacktrace(capturedErrors.CHROMIUM_EMBEDDED_FRAMEWORK_CUSTOM_SCHEME as unknown as Error);

            expect(stackFrames).toHaveLength(1);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "examplescheme://examplehost/cd351f7250857e22ceaa.worker.js", 70_179, 15]);
        });

        it("should parse V8 Error.stack", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_15 as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["bar", "http://path/to/file.js", 13, 17, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["bar", "http://path/to/file.js", 16, 5, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["foo", "http://path/to/file.js", 20, 5, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 24, 4, undefined]);
        });

        it("should parse V8 Error.stack entries with port numbers", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_36 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["dumpExceptionError", "http://localhost:8080/file.js", 41, 27]);
            expect(stackFrames[1]).toMatchStackFrame(["HTMLButtonElement.onclick", "http://localhost:8080/file.js", 107, 146]);
            expect(stackFrames[2]).toMatchStackFrame(["I.e.fn.(anonymous function) [as index]", "http://localhost:8080/file.js", 10, 3651]);
        });

        it("should parse eval() from V8", () => {
            expect.assertions(9);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_58_EVAL as unknown as Error);

            expect(stackFrames).toHaveLength(6);
            expect(stackFrames[0]).toMatchStackFrame([
                "willThrow",
                "index.js",
                11,
                undefined,
                "eval",
                { column: 3, file: "<anonymous>", line: 3, methodName: "eval", type: "eval" },
            ]);
            expect(stackFrames[1]).toMatchStackFrame([
                "eval",
                "index.js",
                11,
                undefined,
                "eval",
                { column: 1, file: "<anonymous>", line: 6, methodName: "eval", type: "eval" },
            ]);
            expect(stackFrames[2]).toMatchStackFrame(["h", "index.js", 11, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["g", "index.js", 6, undefined]);
            expect(stackFrames[4]).toMatchStackFrame(["f", "index.js", 2, undefined]);
            expect(stackFrames[5]).toMatchStackFrame(["<unknown>", "index.js", 23, undefined]);

            const stackFrames2 = parseStacktrace({
                stack: `ReferenceError: a is not defined
    at $$.onStart (eval at <anonymous> (http://localhost:8080/hg/html/js/homegenie.webapp.js?version=r525:6851:25), <anonymous>:32:7)
    at $$.RenderWidget (http://localhost:8080/hg/html/js/homegenie.webapp.js?version=r525:6770:36)
    at $$.RenderView (http://localhost:8080/hg/html/js/homegenie.webapp.js?version=r525:6757:12)
    at http://localhost:8080/hg/html/js/homegenie.webapp.js?version=r525:6879:24
    at Object.$.ajax.success (http://localhost:8080/hg/html/js/homegenie.api.js?version=r525:724:21)
    at l (http://localhost:8080/hg/html/js/jquery-2.0.2.min.js:3:24881)
    at Object.c.fireWith [as resolveWith] (http://localhost:8080/hg/html/js/jquery-2.0.2.min.js:3:25702)
    at k (http://localhost:8080/hg/html/js/jquery-2.0.2.min.js:5:4919)
    at XMLHttpRequest.<anonymous> (http://localhost:8080/hg/html/js/jquery-2.0.2.min.js:5:8723)`,
            } as unknown as Error);

            expect(stackFrames2).toHaveLength(9);
            expect(stackFrames2[0]).toMatchStackFrame([
                "$$.onStart",
                "http://localhost:8080/hg/html/js/homegenie.webapp.js?version=r525",
                6851,
                25,
                "eval",
                { column: 7, file: "<anonymous>", line: 32, methodName: "eval", type: "eval" },
            ]);
        });

        it("should parse nested eval() from V8", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_48_NESTED_EVAL as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame([
                "baz",
                "http://localhost:8080/file.js",
                21,
                17,
                "eval",
                { column: 30, file: "<anonymous>", line: 1, methodName: "eval", type: "eval" },
            ]);
            expect(stackFrames[1]).toMatchStackFrame([
                "foo",
                "http://localhost:8080/file.js",
                21,
                17,
                "eval",
                {
                    column: 96,
                    file: "<anonymous>",
                    line: 2,
                    methodName: "eval",
                    type: "eval",
                },
            ]);
            expect(stackFrames[2]).toMatchStackFrame([
                "eval",
                "http://localhost:8080/file.js",
                21,
                17,
                "eval",
                {
                    column: 18,
                    file: "<anonymous>",
                    line: 4,
                    methodName: "eval",
                    type: "eval",
                },
            ]);
            expect(stackFrames[3]).toMatchStackFrame(["Object.speak", "http://localhost:8080/file.js", 21, 17]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "http://localhost:8080/file.js", 31, 13]);
        });

        it("should parse error stacks with constructors", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_46 as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["new CustomError", "http://localhost:8080/file.js", 41, 27]);
            expect(stackFrames[1]).toMatchStackFrame(["HTMLButtonElement.onclick", "http://localhost:8080/file.js", 107, 146]);
        });

        it("should parses Chrome 76 error with async support", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_76 as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["bar", "<anonymous>", 8, 9]);
            expect(stackFrames[1]).toMatchStackFrame(["async foo", "<anonymous>", 2, 3]);
        });

        it("should parses Chrome error with webpack URLs", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_XX_WEBPACK as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame(["TESTTESTTEST.eval", "webpack:///./src/components/test/test.jsx?", 295, 108]);
            expect(stackFrames[1]).toMatchStackFrame(["TESTTESTTEST.render", "webpack:///./src/components/test/test.jsx?", 272, 32]);
            expect(stackFrames[2]).toMatchStackFrame(["TESTTESTTEST.tryRender", "webpack:///./~/react-transform-catch-errors/lib/index.js?", 34, 31]);
            expect(stackFrames[3]).toMatchStackFrame(["TESTTESTTEST.proxiedMethod", "webpack:///./~/react-proxy/modules/createPrototypeProxy.js?", 44, 30]);
            expect(stackFrames[4]).toMatchStackFrame(["Module../pages/index.js", String.raw`C:\root\server\development\pages\index.js`, 182, 7]);
        });

        it("should parses Chrome error with blob URLs", () => {
            expect.assertions(8);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_48_BLOB as unknown as Error);

            expect(stackFrames).toHaveLength(7);
            expect(stackFrames[0]).toMatchStackFrame(["Error", "native", undefined, undefined, "native"]);
            expect(stackFrames[1]).toMatchStackFrame(["s", "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 31, 29_146]);
            expect(stackFrames[2]).toMatchStackFrame(["Object.d [as add]", "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 31, 30_039]);

            expect(stackFrames[3]).toMatchStackFrame(["<unknown>", "blob:http%3A//localhost%3A8080/d4eefe0f-361a-4682-b217-76587d9f712a", 15, 10_978]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 1, 6911]);
            expect(stackFrames[5]).toMatchStackFrame(["n.fire", "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 7, 3019]);
            expect(stackFrames[6]).toMatchStackFrame(["n.handle", "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 7, 2863]);
        });

        it("should parse Chrome 73 with native code frames", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.CHROME73_NATIVE_CODE_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["fooIterator", "http://localhost:5000/test", 20, 17]);
            expect(stackFrames[1]).toMatchStackFrame(["Array.map", "<anonymous>", undefined, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["foo", "http://localhost:5000/test", 19, 19]);
            expect(stackFrames[3]).toMatchStackFrame(["<unknown>", "http://localhost:5000/test", 24, 7]);
        });

        it("should parse exceptions with eval frames in Chrome 73", () => {
            expect.assertions(11);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_73_EVAL_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(10);
            expect(stackFrames[0]).toMatchStackFrame(["Object.aha", "http://localhost:5000/", 19, 13]);
            expect(stackFrames[1]).toMatchStackFrame(["callAnotherThing", "http://localhost:5000/", 20, 16]);
            expect(stackFrames[2]).toMatchStackFrame(["Object.callback", "http://localhost:5000/", 25, 7]);
            expect(stackFrames[3]).toMatchStackFrame(["<unknown>", "http://localhost:5000/", 34, 17]);
            expect(stackFrames[4]).toMatchStackFrame(["Array.map", "<anonymous>", undefined, undefined]);
            expect(stackFrames[5]).toMatchStackFrame(["test", "http://localhost:5000/", 33, 23]);
            expect(stackFrames[6]).toMatchStackFrame([
                "eval",
                "http://localhost:5000/",
                37,
                5,
                "eval",
                {
                    column: 1,
                    file: "<anonymous>",
                    line: 1,
                    methodName: "eval",
                    type: "eval",
                },
            ]);
            expect(stackFrames[7]).toMatchStackFrame(["aha", "http://localhost:5000/", 39, 5]);
            expect(stackFrames[8]).toMatchStackFrame(["Foo.testMethod", "http://localhost:5000/", 44, 7]);
            expect(stackFrames[9]).toMatchStackFrame(["<unknown>", "http://localhost:5000/", 50, 19]);
        });

        it("should parse frames with async urls", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_109_ASYNC_URL as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["callAnotherThing", "http://localhost:5000/", 20, 16]);
            expect(stackFrames[1]).toMatchStackFrame(["Object.callback", "http://localhost:5000/", 25, 7]);
            expect(stackFrames[2]).toMatchStackFrame(["test", "http://localhost:5000/", 33, 23]);
        });

        // Release 2015
        it("should parse nested eval() from Edge", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(capturedErrors.EDGE_20_NESTED_EVAL as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame(["baz", "eval code", 1, 18, "eval"]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "eval code", 2, 90, "eval"]);
            expect(stackFrames[2]).toMatchStackFrame(["eval code", "eval code", 4, 18, "eval"]);
            expect(stackFrames[3]).toMatchStackFrame(["speak", "http://localhost:8080/file.js", 25, 17]);
            expect(stackFrames[4]).toMatchStackFrame(["Global code", "http://localhost:8080/file.js", 32, 9]);
        });

        it("should parse exceptions with native code frames in Edge 44", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.EDGE_44_NATIVE_CODE_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["fooIterator", "http://localhost:5000/test", 20, 11]);
            expect(stackFrames[1]).toMatchStackFrame(["Array.prototype.map", "native code", undefined, undefined, "native"]);
            expect(stackFrames[2]).toMatchStackFrame(["foo", "http://localhost:5000/test", 19, 9]);
            expect(stackFrames[3]).toMatchStackFrame(["Global code", "http://localhost:5000/test", 24, 7]);
        });

        it("should parse exceptions with eval frames in Edge 44", () => {
            expect.assertions(11);

            const stackFrames = parseStacktrace(capturedErrors.EDGE_44_EVAL_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(10);
            expect(stackFrames[0]).toMatchStackFrame(["aha", "http://localhost:5000/", 19, 7]);
            expect(stackFrames[1]).toMatchStackFrame(["callAnotherThing", "http://localhost:5000/", 18, 6]);
            expect(stackFrames[2]).toMatchStackFrame(["callback", "http://localhost:5000/", 25, 7]);
            expect(stackFrames[3]).toMatchStackFrame(["<anonymous>", "http://localhost:5000/", 34, 7]);
            expect(stackFrames[4]).toMatchStackFrame(["Array.prototype.map", "native code", undefined, undefined, "native"]);
            expect(stackFrames[5]).toMatchStackFrame(["test", "http://localhost:5000/", 33, 5]);
            expect(stackFrames[6]).toMatchStackFrame(["eval code", "eval code", 1, 1, "eval"]);
            expect(stackFrames[7]).toMatchStackFrame(["aha", "http://localhost:5000/", 39, 5]);
            expect(stackFrames[8]).toMatchStackFrame(["Foo.prototype.testMethod", "http://localhost:5000/", 44, 7]);
            expect(stackFrames[9]).toMatchStackFrame(["<anonymous>", "http://localhost:5000/", 50, 8]);
        });

        it("should parse exceptions called within an iframe in Electron Renderer", () => {
            expect.assertions(2);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_ELECTRON_RENDERER as unknown as Error);

            expect(stackFrames).toHaveLength(1);
            expect(stackFrames[0]).toMatchStackFrame(["TESTTESTTEST.someMethod", String.raw`C:\Users\user\path\to\file.js`, 295, 108]);
        });

        it("should parse exceptions with frames without full paths", () => {
            expect.assertions(7);

            const EXCEPTION = {
                message: "aha",
                name: "Error",
                stack: `Error
      at Client.requestPromise (api.tsx:554:1)
      at doDiscoverQuery (genericDiscoverQuery.tsx?33f8:328:1)
      at _GenericDiscoverQuery.eval [as fetchData] (genericDiscoverQuery.tsx?33f8:256:1)
      at _GenericDiscoverQuery.componentDidMount (genericDiscoverQuery.tsx?33f8:152:1)
      at commitLifeCycles (react-dom.development.js?f8c1:20663:1)
      at commitLayoutEffects (react-dom.development.js?f8c1:23426:1)`,
            };

            const stackFrames = parseStacktrace(EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(6);
            expect(stackFrames[0]).toMatchStackFrame(["Client.requestPromise", "api.tsx", 554, 1]);
            expect(stackFrames[1]).toMatchStackFrame(["doDiscoverQuery", "genericDiscoverQuery.tsx?33f8", 328, 1]);
            expect(stackFrames[2]).toMatchStackFrame(["_GenericDiscoverQuery.eval [as fetchData]", "genericDiscoverQuery.tsx?33f8", 256, 1]);
            expect(stackFrames[3]).toMatchStackFrame(["_GenericDiscoverQuery.componentDidMount", "genericDiscoverQuery.tsx?33f8", 152, 1]);
            expect(stackFrames[4]).toMatchStackFrame(["commitLifeCycles", "react-dom.development.js?f8c1", 20_663, 1]);
            expect(stackFrames[5]).toMatchStackFrame(["commitLayoutEffects", "react-dom.development.js?f8c1", 23_426, 1]);
        });

        it("should parse webpack wrapped exceptions", () => {
            expect.assertions(5);

            const EXCEPTION = {
                message: "aha",
                name: "ChunkLoadError",
                stack: `ChunkLoadError: Loading chunk app_bootstrap_initializeLocale_tsx failed.
      (error: https://s1.sentry-cdn.com/_static/dist/sentry/chunks/app_bootstrap_initializeLocale_tsx.abcdefg.js)
        at (error: (/_static/dist/sentry/chunks/app_bootstrap_initializeLocale_tsx.abcdefg.js))
        at key(webpack/runtime/jsonp chunk loading:27:18)
        at ? (webpack/runtime/ensure chunk:6:25)
        at Array.reduce(<anonymous>)`,
            };

            const stackFrames = parseStacktrace(EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame([
                "<unknown>",
                "/_static/dist/sentry/chunks/app_bootstrap_initializeLocale_tsx.abcdefg.js",
                undefined,
                undefined,
            ]);
            expect(stackFrames[1]).toMatchStackFrame(["key", "webpack/runtime/jsonp chunk loading", 27, 18]);
            expect(stackFrames[2]).toMatchStackFrame(["?", "webpack/runtime/ensure chunk", 6, 25]);
            expect(stackFrames[3]).toMatchStackFrame(["Array.reduce", "<anonymous>", undefined, undefined]);
        });

        it("handles braces in urls", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.CHROME_BRACES_URL as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["something", "http://localhost:5000/(some)/(thing)/index.html", 20, 16]);
            expect(stackFrames[1]).toMatchStackFrame(["more", "http://localhost:5000/(some)/(thing)/index.html", 25, 7]);
        });

        it("should drop frames that are over 1kb", () => {
            expect.assertions(3);

            const LONG_STR = "A".repeat(1040);

            const LONG_FRAME = {
                message: "bad",
                name: "Error",
                stack: `Error: bad
          at aha (http://localhost:5000/:39:5)
          at Foo.testMethod (http://localhost:5000/${LONG_STR}:44:7)
          at http://localhost:5000/:50:19`,
            };

            const stackFrames = parseStacktrace(LONG_FRAME as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["aha", "http://localhost:5000/", 39, 5]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "http://localhost:5000/", 50, 19]);
        });
    });

    describe("firefox", () => {
        it("should parse Firefox 3 error", () => {
            expect.assertions(8);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_3 as unknown as Error);

            expect(stackFrames).toHaveLength(7);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://127.0.0.1:8000/js/stacktrace.js", 44, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "http://127.0.0.1:8000/js/stacktrace.js", 31, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["printStackTrace", "http://127.0.0.1:8000/js/stacktrace.js", 18, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["bar", "http://127.0.0.1:8000/js/file.js", 13, undefined]);
            expect(stackFrames[4]).toMatchStackFrame(["bar", "http://127.0.0.1:8000/js/file.js", 16, undefined]);
            expect(stackFrames[5]).toMatchStackFrame(["foo", "http://127.0.0.1:8000/js/file.js", 20, undefined]);
            expect(stackFrames[6]).toMatchStackFrame(["<unknown>", "http://127.0.0.1:8000/js/file.js", 24, undefined]);
        });

        it("should parse Firefox 7 error", () => {
            expect.assertions(8);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_7 as unknown as Error);

            expect(stackFrames).toHaveLength(7);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "file:///G:/js/stacktrace.js", 44, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "file:///G:/js/stacktrace.js", 31, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["printStackTrace", "file:///G:/js/stacktrace.js", 18, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["bar", "file:///G:/js/file.js", 13, undefined]);
            expect(stackFrames[4]).toMatchStackFrame(["bar", "file:///G:/js/file.js", 16, undefined]);
            expect(stackFrames[5]).toMatchStackFrame(["foo", "file:///G:/js/file.js", 20, undefined]);
            expect(stackFrames[6]).toMatchStackFrame(["<unknown>", "file:///G:/js/file.js", 24, undefined]);
        });

        it("should parse Firefox 14 error", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_14 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 48, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["dumpException3", "http://path/to/file.js", 52, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["onclick", "http://path/to/file.js", 1, undefined]);
        });

        it("should parse Firefox 31 Error.stack", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_31 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["foo", "http://path/to/file.js", 41, 13]);
            expect(stackFrames[1]).toMatchStackFrame(["bar", "http://path/to/file.js", 1, 1]);
        });

        it("should parse nested eval() from Firefox 43", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_43_NESTED_EVAL as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame([
                "baz",
                "http://localhost:8080/file.js",
                26,
                undefined,
                "eval",
                {
                    column: 30,
                    file: "http://localhost:8080/file.js",
                    line: 1,
                    methodName: "eval",
                    type: "eval",
                },
            ]);
            expect(stackFrames[1]).toMatchStackFrame([
                "foo",
                "http://localhost:8080/file.js",
                26,
                undefined,
                "eval",
                {
                    column: 96,
                    file: "http://localhost:8080/file.js",
                    line: 2,
                    methodName: "eval",
                    type: "eval",
                },
            ]);
            expect(stackFrames[2]).toMatchStackFrame([
                "<unknown>",
                "http://localhost:8080/file.js",
                26,
                undefined,
                "eval",
                {
                    column: 18,
                    file: "http://localhost:8080/file.js",
                    line: 4,
                    methodName: "eval",
                    type: "eval",
                },
            ]);
            expect(stackFrames[3]).toMatchStackFrame(["speak", "http://localhost:8080/file.js", 26, 17]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "http://localhost:8080/file.js", 33, 9]);
        });

        it("should parse function names containing @ in Firefox 43 Error.stack", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_43_FUNCTION_NAME_WITH_AT_SIGN as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["obj[\"@fn\"]", "Scratchpad/1", 10, 29]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "Scratchpad/1", 11, 1]);
        });

        it("should parse Firefox 44 ns exceptions", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_44_NS_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["[2]</Bar.prototype._baz/</<", "http://path/to/file.js", 703, 28]);
            expect(stackFrames[1]).toMatchStackFrame(["App.prototype.foo", "file:///path/to/file.js", 15, 2]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "file:///path/to/file.js", 20, 3]);
            expect(stackFrames[3]).toMatchStackFrame(["<unknown>", "file:///path/to/index.html", 23, 1]);
        });

        it("should parses Firefox errors with resource: URLs", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_50_RESOURCE_URL as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["render", "resource://path/data/content/bundle.js", 5529, 16, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["dispatchEvent", "resource://path/data/content/vendor.bundle.js", 18, 23_028, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["wrapped", "resource://path/data/content/bundle.js", 7270, 25, undefined]);
        });

        // Release 2018
        it("should parse stack traces with @ in the URL", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_60_URL_WITH_AT_SIGN as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame(["who", "http://localhost:5000/misc/@stuff/foo.js", 3, 9, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["what", "http://localhost:5000/misc/@stuff/foo.js", 6, 3, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["where", "http://localhost:5000/misc/@stuff/foo.js", 9, 3, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["why", "https://localhost:5000/misc/@stuff/foo.js", 12, 3, undefined]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "http://localhost:5000/misc/@stuff/foo.js", 15, 1, undefined]);
        });

        // Release 2018
        it("should parse stack traces with @ in the URL and the method", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_60_URL_AND_FUNCTION_NAME_WITH_AT_SIGN as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame(["obj[\"@who\"]", "http://localhost:5000/misc/@stuff/foo.js", 4, 9, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["what", "http://localhost:5000/misc/@stuff/foo.js", 8, 3, undefined]);
        });

        it("should parse exceptions with native code frames in Firefox 66", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_66_NATIVE_CODE_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["fooIterator", "http://localhost:5000/test", 20, 17]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://localhost:5000/test", 19, 19]);
            expect(stackFrames[2]).toMatchStackFrame(["<unknown>", "http://localhost:5000/test", 24, 7]);
        });

        it("should parse exceptions with eval frames in Firefox 66", () => {
            expect.assertions(10);

            const stackFrames = parseStacktrace(capturedErrors.FIREFOX_66_EVAL_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(9);
            expect(stackFrames[0]).toMatchStackFrame(["aha", "http://localhost:5000/", 19, 13]);
            expect(stackFrames[1]).toMatchStackFrame(["callAnotherThing", "http://localhost:5000/", 20, 15]);
            expect(stackFrames[2]).toMatchStackFrame(["callback", "http://localhost:5000/", 25, 7]);
            expect(stackFrames[3]).toMatchStackFrame(["test/<", "http://localhost:5000/", 34, 7]);
            expect(stackFrames[4]).toMatchStackFrame(["test", "http://localhost:5000/", 33, 23]);
            expect(stackFrames[5]).toMatchStackFrame([
                "<unknown>",
                "http://localhost:5000/",
                39,
                undefined,
                "eval",
                { column: 1, file: "http://localhost:5000/", line: 1, methodName: "eval", type: "eval" },
            ]);
            expect(stackFrames[6]).toMatchStackFrame(["aha", "http://localhost:5000/", 39, 5]);
            expect(stackFrames[7]).toMatchStackFrame(["testMethod", "http://localhost:5000/", 44, 7]);
            expect(stackFrames[8]).toMatchStackFrame(["<unknown>", "http://localhost:5000/", 50, 19]);
        });

        it("should match debugger stack trace", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace({
                // eslint-disable-next-line no-useless-concat
                stack: "foo@debugger eval code:1:27\n" + "bar@debugger eval code:1:13\n" + "@debugger eval code:1:13",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["foo", "debugger eval code", 1, 27]);
            expect(stackFrames[1]).toMatchStackFrame(["bar", "debugger eval code", 1, 13]);
            expect(stackFrames[2]).toMatchStackFrame(["<unknown>", "debugger eval code", 1, 13]);
        });

        it("should should match stack trace #2", () => {
            expect.assertions(2);

            const stackFrames = parseStacktrace({ stack: "@http://localhost:3000/App.jsx?t=1589606689786:33:7" } as unknown as Error);

            expect(stackFrames).toHaveLength(1);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://localhost:3000/App.jsx?t=1589606689786", 33, 7]);
        });

        it("should should match stack trace #3", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace({
                stack:
                    "App@http://localhost:3000/App.jsx?t=1589606715125:31:9\n"
                    + "E@http://localhost:3000/@modules/preact/dist/preact.mjs?import:1:7584\n"
                    + "b/l.__k<@http://localhost:3000/@modules/preact/dist/preact.mjs?import:1:1908\n"
                    + "@http://localhost:3000/main.js:52:7\n",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["App", "http://localhost:3000/App.jsx?t=1589606715125", 31, 9]);
            expect(stackFrames[1]).toMatchStackFrame(["E", "http://localhost:3000/@modules/preact/dist/preact.mjs?import", 1, 7584]);
            expect(stackFrames[2]).toMatchStackFrame(["b/l.__k<", "http://localhost:3000/@modules/preact/dist/preact.mjs?import", 1, 1908]);
            expect(stackFrames[3]).toMatchStackFrame(["<unknown>", "http://localhost:3000/main.js", 52, 7]);
        });

        it("should parse errors from about:blank", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace({
                stack: `@about:blank line 5 > injectedScript:1:7\n@debugger eval code:5:15\n`,
            } as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "about:blank line 5 > injectedScript", 1, 7]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "debugger eval code", 5, 15]);
        });
    });

    describe("ie", () => {
        // Release 2012
        it("should parse IE 10 Error stacks", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.IE_10 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["<anonymous>", "http://path/to/file.js", 48, 13]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 46, 9]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "http://path/to/file.js", 82, 1]);
        });

        // Release 2013
        it("should parse IE 11 Error stacks", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.IE_11 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["<anonymous>", "http://path/to/file.js", 47, 21]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 45, 13]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "http://path/to/file.js", 108, 1]);
        });

        it("should parses IE 11 eval error", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.IE_11_EVAL as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["eval code", "eval code", 1, 1, "eval"]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 58, 17]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "http://path/to/file.js", 109, 1]);
        });
    });

    describe("webpack", () => {
        it("should handle webpack error stack", () => {
            expect.assertions(11);

            const stackFrames = parseStacktrace({
                stack:
                    "at tryRunOrWebpackError (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/HookWebpackError.js:88:9)\n"
                    + "at __webpack_require_module__ (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:5051:12)\n"
                    + "at __webpack_require__ (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:5008:18)\n"
                    + "at /usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:5079:20\n"
                    + "at symbolIterator (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js:3485:9)\n"
                    + "at done (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js:3527:9)\n"
                    + "at Hook.eval [as callAsync] (eval at create (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/HookCodeFactory.js:33:10), <anonymous>:15:1)\n"
                    + "at Hook.CALL_ASYNC_DELEGATE [as _callAsync] (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/Hook.js:18:14)\n"
                    + "at /usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:4986:43\n"
                    + "at symbolIterator (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js:3482:9)\n",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(10);

            expect(stackFrames[0]).toMatchStackFrame([
                "tryRunOrWebpackError",

                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/HookWebpackError.js",
                88,
                9,
            ]);
            expect(stackFrames[1]).toMatchStackFrame([
                "__webpack_require_module__",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
                5051,
                12,
            ]);
            expect(stackFrames[2]).toMatchStackFrame([
                "__webpack_require__",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
                5008,
                18,
            ]);
            expect(stackFrames[3]).toMatchStackFrame([
                "<unknown>",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
                5079,
                20,
            ]);
            expect(stackFrames[4]).toMatchStackFrame([
                "symbolIterator",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js",
                3485,
                9,
            ]);
            expect(stackFrames[5]).toMatchStackFrame([
                "done",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js",
                3527,
                9,
            ]);
            expect(stackFrames[6]).toMatchStackFrame([
                "Hook.eval [as callAsync]",

                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/HookCodeFactory.js",
                33,
                10,
                "eval",
                {
                    column: 1,
                    file: "<anonymous>",
                    line: 15,
                    methodName: "eval",
                    type: "eval",
                },
            ]);
            expect(stackFrames[7]).toMatchStackFrame([
                "Hook.CALL_ASYNC_DELEGATE [as _callAsync]",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/Hook.js",
                18,
                14,
            ]);
            expect(stackFrames[8]).toMatchStackFrame([
                "<unknown>",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
                4986,
                43,
            ]);
            expect(stackFrames[9]).toMatchStackFrame([
                "symbolIterator",
                "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js",
                3482,
                9,
            ]);
        });

        it("should handle webpack eval stacks", () => {
            expect.assertions(11);

            const stackFrames = parseStacktrace({
                stack:
                    "ReferenceError: chilxdren is not defined\n"
                    + "at new Layout (webpack:///./src/Layout.js?:25:5)\n"
                    + "at eval (webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?:90:24)\n"
                    + "at instantiate (webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?:98:9)\n"
                    + "at Layout (eval at proxyClass (webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?), <anonymous>:4:17)\n"
                    + "at ReactCompositeComponentMixin.mountComponent (webpack:///./~/react/lib/ReactCompositeComponent.js?:170:18)\n"
                    + "at wrapper [as mountComponent] (webpack:///./~/react/lib/ReactPerf.js?:66:21)\n"
                    + "at Object.ReactReconciler.mountComponent (webpack:///./~/react/lib/ReactReconciler.js?:39:35)\n"
                    + "at ReactCompositeComponentMixin.performInitialMount (webpack:///./~/react/lib/ReactCompositeComponent.js?:289:34)\n"
                    + "at ReactCompositeComponentMixin.mountComponent (webpack:///./~/react/lib/ReactCompositeComponent.js?:237:21)\n"
                    + "at wrapper [as mountComponent] (webpack:///./~/react/lib/ReactPerf.js?:66:21)\n",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(10);
            expect(stackFrames[0]).toMatchStackFrame(["new Layout", "webpack:///./src/Layout.js?", 25, 5]);
            expect(stackFrames[1]).toMatchStackFrame(["eval", "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?", 90, 24, "eval"]);
            expect(stackFrames[2]).toMatchStackFrame(["instantiate", "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?", 98, 9]);
            expect(stackFrames[3]).toMatchStackFrame([
                "Layout",
                "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?",
                4,
                17,
                "eval",
                { column: 17, file: "<anonymous>", line: 4, methodName: "eval", type: "eval" },
            ]);
            expect(stackFrames[4]).toMatchStackFrame([
                "ReactCompositeComponentMixin.mountComponent",
                "webpack:///./~/react/lib/ReactCompositeComponent.js?",
                170,
                18,
            ]);
            expect(stackFrames[5]).toMatchStackFrame(["wrapper [as mountComponent]", "webpack:///./~/react/lib/ReactPerf.js?", 66, 21]);
            expect(stackFrames[6]).toMatchStackFrame(["Object.ReactReconciler.mountComponent", "webpack:///./~/react/lib/ReactReconciler.js?", 39, 35]);
            expect(stackFrames[7]).toMatchStackFrame([
                "ReactCompositeComponentMixin.performInitialMount",
                "webpack:///./~/react/lib/ReactCompositeComponent.js?",
                289,
                34,
            ]);
            expect(stackFrames[8]).toMatchStackFrame([
                "ReactCompositeComponentMixin.mountComponent",
                "webpack:///./~/react/lib/ReactCompositeComponent.js?",
                237,
                21,
            ]);
            expect(stackFrames[9]).toMatchStackFrame(["wrapper [as mountComponent]", "webpack:///./~/react/lib/ReactPerf.js?", 66, 21]);
        });

        it("should parse source mappings from chrome webpack", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace({
                // eslint-disable-next-line no-useless-concat
                stack: "Error: fail\n" + "    at foo (<anonymous>:1:33)\n" + "    at bar (<anonymous>:1:19 <- <anonymous>:2:3)\n" + "    at <anonymous>:1:13\n",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["foo", "<anonymous>", 1, 33]);
            expect(stackFrames[1]).toMatchStackFrame(["bar", "<anonymous>", 1, 19]);
            expect(stackFrames[2]).toMatchStackFrame(["<unknown>", "<anonymous>", 1, 13]);
        });

        it("should parse webpack-internal", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(
                {
                    stack: `
react-dom.development.js:67 Warning: Each child in a list should have a unique "key" prop. See https://reactjs.org/link/warning-keys for more information.
    at div
    at Grid (webpack-internal:///./node_modules/@material-ui/core/esm/Grid/Grid.js:235:35)
    at WithStyles (webpack-internal:///./node_modules/@material-ui/styles/esm/withStyles/withStyles.js:61:31)
    at div
    at Grid (webpack-internal:///./node_modules/@material-ui/core/esm/Grid/Grid.js:235:35)
    at WithStyles (webpack-internal:///./node_modules/@material-ui/styles/esm/withStyles/withStyles.js:61:31)
    at div
    at Grid (webpack-internal:///./node_modules/@material-ui/core/esm/Grid/Grid.js:235:35)
    at WithStyles (webpack-internal:///./node_modules/@material-ui/styles/esm/withStyles/withStyles.js:61:31)
    at div
    at div
    at Container (webpack-internal:///./node_modules/@material-ui/core/esm/Container/Container.js:84:23)
    at WithStyles (webpack-internal:///./node_modules/@material-ui/styles/esm/withStyles/withStyles.js:61:31)
    at ContentWrapper (webpack-internal:///./src/components/content-wrapper.js:26:23)
    at div
    at Grid (webpack-internal:///./node_modules/@material-ui/core/esm/Grid/Grid.js:235:35)
    at WithStyles (webpack-internal:///./node_modules/@material-ui/styles/esm/withStyles/withStyles.js:61:31)
    at Footer (webpack-internal:///./src/components/common/footer/index.js:127:28)
    at Layout (webpack-internal:///./src/components/Layout/index.js:28:23)
    at LandingTemplate (webpack-internal:///./src/templates/landing/index.js:105:23)
    at PageRenderer (webpack-internal:///./.cache/page-renderer.js:23:29)
    at PageQueryStore (webpack-internal:///./.cache/query-result-store.js:39:30)
    at RouteHandler
    at div
    at FocusHandlerImpl (webpack-internal:///./node_modules/@gatsbyjs/reach-router/es/index.js:359:5)
    at FocusHandler (webpack-internal:///./node_modules/@gatsbyjs/reach-router/es/index.js:330:19)
    at RouterImpl (webpack-internal:///./node_modules/@gatsbyjs/reach-router/es/index.js:235:5)
    at Location (webpack-internal:///./node_modules/@gatsbyjs/reach-router/es/index.js:64:23)
    at Router
    at ScrollHandler (webpack-internal:///./node_modules/gatsby-react-router-scroll/scroll-handler.js:36:35)
    at RouteUpdates (webpack-internal:///./.cache/navigation.js:286:32)
    at EnsureResources (webpack-internal:///./.cache/ensure-resources.js:22:30)
    at LocationHandler (webpack-internal:///./.cache/root.js:67:29)
    at Location (webpack-internal:///./node_modules/@gatsbyjs/reach-router/es/index.js:64:23)
    at Root
    at ThemeProvider (webpack-internal:///./node_modules/@material-ui/styles/esm/ThemeProvider/ThemeProvider.js:41:24)
    at TopLayout (webpack-internal:///./plugins/gatsby-plugin-top-layout/TopLayout.js:22:23)
    at StylesProvider (webpack-internal:///./node_modules/@material-ui/styles/esm/StylesProvider/StylesProvider.js:49:24)
    at GatedContentHandler (webpack-internal:///./src/utils/GatedContentHandler.js:31:23)
    at LocationProvider (webpack-internal:///./node_modules/@gatsbyjs/reach-router/es/index.js:84:5)
    at Location (webpack-internal:///./node_modules/@gatsbyjs/reach-router/es/index.js:64:23)
    at withLocation (webpack-internal:///./src/utils/GatedContentHandler.js:70:24)
    at eval (webpack-internal:///./src/components/Search/SearchContext.js:46:25)
    at SalesforceProvider (webpack-internal:///./src/components/Salesforce/SalesforceProvider.js:28:66)
    at CookiesProvider (webpack-internal:///./node_modules/react-cookie/es6/CookiesProvider.js:24:28)
    at AuthProvider (webpack-internal:///./src/utils/context/AuthContext.js:50:23)
    at ApolloProvider (webpack-internal:///./node_modules/@apollo/client/react/context/ApolloProvider.js:12:21)
    at Apollo (webpack-internal:///./src/providers/apollo.js:34:23)
    at StaticQueryStore (webpack-internal:///./.cache/query-result-store.js:127:32)
    at ErrorBoundary (webpack-internal:///./.cache/fast-refresh-overlay/components/error-boundary.js:24:35)
    at DevOverlay (webpack-internal:///./.cache/fast-refresh-overlay/index.js:114:23)
    at RootWrappedWithOverlayAndProvider
    at App (webpack-internal:///./.cache/app.js:209:68)
`,
                } as unknown as Error,
                {
                    frameLimit: 55,
                },
            );

            expect(stackFrames).toHaveLength(53);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "div", undefined, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["Grid", "webpack-internal:///./node_modules/@material-ui/core/esm/Grid/Grid.js", 235, 35]);
            expect(stackFrames[2]).toMatchStackFrame([
                "WithStyles",
                "webpack-internal:///./node_modules/@material-ui/styles/esm/withStyles/withStyles.js",
                61,
                31,
            ]);
            expect(stackFrames[42]).toMatchStackFrame(["eval", "webpack-internal:///./src/components/Search/SearchContext.js", 46, 25, "eval"]);
            expect(stackFrames[52]).toMatchStackFrame(["App", "webpack-internal:///./.cache/app.js", 209, 68]);
        });
    });

    describe("react native", () => {
        it("should parse exceptions for react-native-v8", () => {
            expect.assertions(8);

            const stackFrames = parseStacktrace(capturedErrors.REACT_NATIVE_V8_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(7);
            expect(stackFrames[0]).toMatchStackFrame(["Object.onPress", "index.android.bundle", 2342, 3773]);
            expect(stackFrames[1]).toMatchStackFrame(["s.touchableHandlePress", "index.android.bundle", 214, 2048]);
            expect(stackFrames[2]).toMatchStackFrame(["s._performSideEffectsForTransition", "index.android.bundle", 198, 9608]);
            expect(stackFrames[3]).toMatchStackFrame(["s._receiveSignal", "index.android.bundle", 198, 8309]);
            expect(stackFrames[4]).toMatchStackFrame(["s.touchableHandleResponderRelease", "index.android.bundle", 198, 5615]);
            expect(stackFrames[5]).toMatchStackFrame(["Object.y", "index.android.bundle", 93, 571]);
            expect(stackFrames[6]).toMatchStackFrame(["P", "index.android.bundle", 93, 714]);
        });

        it("should parse exceptions for react-native Expo bundles", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(capturedErrors.REACT_NATIVE_EXPO_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame([
                "onPress",

                "/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3",
                595,
                658,
            ]);
            expect(stackFrames[1]).toMatchStackFrame([
                "value",

                "/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3",
                221,
                7656,
            ]);
            expect(stackFrames[2]).toMatchStackFrame([
                "onResponderRelease",

                "/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3",
                221,
                5666,
            ]);
            expect(stackFrames[3]).toMatchStackFrame([
                "p",

                "/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3",
                96,
                385,
            ]);
            expect(stackFrames[4]).toMatchStackFrame(["forEach", "[native code]", undefined, undefined, "native"]);
        });

        it("should parses an error in react native", () => {
            expect.assertions(12);

            const stackFrames = parseStacktrace(capturedErrors.IOS_REACT_NATIVE_2 as unknown as Error);

            expect(stackFrames).toHaveLength(11);
            expect(stackFrames[0]).toMatchStackFrame(["s", "33.js", 1, 531, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["b", "1959.js", 1, 1469, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["onSocketClose", "2932.js", 1, 727, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["value", "81.js", 1, 1505, undefined]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "102.js", 1, 2956, undefined]);
            expect(stackFrames[5]).toMatchStackFrame(["value", "89.js", 1, 1247, undefined]);
            expect(stackFrames[6]).toMatchStackFrame(["value", "42.js", 1, 3311, undefined]);
            expect(stackFrames[7]).toMatchStackFrame(["<unknown>", "42.js", 1, 822, undefined]);
            expect(stackFrames[8]).toMatchStackFrame(["value", "42.js", 1, 2565, undefined]);
            expect(stackFrames[9]).toMatchStackFrame(["value", "42.js", 1, 794, undefined]);
            expect(stackFrames[10]).toMatchStackFrame(["value", "[native code]", undefined, undefined, "native"]);
        });

        it("should parses very simple JavaScriptCore errors", () => {
            expect.assertions(2);

            const stackFrames = parseStacktrace({ stack: "global code@stack_traces/test:83:55" } as unknown as Error);

            expect(stackFrames).toHaveLength(1);
            expect(stackFrames[0]).toMatchStackFrame(["global code", "stack_traces/test", 83, 55, undefined]);
        });

        it("should parses React Native errors on Android", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.ANDROID_REACT_NATIVE as unknown as Error);

            expect(stackFrames).toHaveLength(8);
            expect(stackFrames[0]).toMatchStackFrame([
                "render",
                "/home/username/sample-workspace/sampleapp.collect.react/src/components/GpsMonitorScene.js",
                78,
                24,
            ]);
            expect(stackFrames[7]).toMatchStackFrame([
                "this",
                "/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/native/ReactNativeBaseComponent.js",
                74,
                41,
            ]);
        });

        it("should parses React Native errors on Android Production", () => {
            expect.assertions(6);

            const stackFrames = parseStacktrace(capturedErrors.ANDROID_REACT_NATIVE_PROD as unknown as Error, {
                frameLimit: 55,
            });

            expect(stackFrames).toHaveLength(37);
            expect(stackFrames[0]).toMatchStackFrame(["value", "index.android.bundle", 12, 1917, undefined]);
            expect(stackFrames[33]).toMatchStackFrame(["<unknown>", "index.android.bundle", 29, 955, undefined]);
            expect(stackFrames[34]).toMatchStackFrame(["value", "index.android.bundle", 29, 2417, undefined]);
            expect(stackFrames[35]).toMatchStackFrame(["value", "index.android.bundle", 29, 927, undefined]);
            expect(stackFrames[36]).toMatchStackFrame(["<unknown>", "[native code]", undefined, undefined, "native"]);
        });

        it("should parse React Native errors on Android Hermes", () => {
            expect.assertions(27);

            const stackFrames = parseStacktrace(capturedErrors.ANDROID_REACT_NATIVE_HERMES as unknown as Error);

            expect(stackFrames).toHaveLength(26);
            expect(stackFrames[0]).toMatchStackFrame(["onPress", "index.android.bundle", 1, 452_701]);
            expect(stackFrames[1]).toMatchStackFrame(["anonymous", "index.android.bundle", 1, 224_280]);
            expect(stackFrames[2]).toMatchStackFrame(["_performSideEffectsForTransition", "index.android.bundle", 1, 230_843]);
            expect(stackFrames[3]).toMatchStackFrame(["_receiveSignal", "native", undefined, undefined, "native"]);
            expect(stackFrames[4]).toMatchStackFrame(["touchableHandleResponderRelease", "native", undefined, undefined, "native"]);
            expect(stackFrames[5]).toMatchStackFrame(["onResponderRelease", "native", undefined, undefined, "native"]);
            expect(stackFrames[6]).toMatchStackFrame(["apply", "native", undefined, undefined, "native"]);
            expect(stackFrames[7]).toMatchStackFrame(["b", "index.android.bundle", 1, 74_037]);
            expect(stackFrames[8]).toMatchStackFrame(["apply", "native", undefined, undefined, "native"]);
            expect(stackFrames[9]).toMatchStackFrame(["k", "index.android.bundle", 1, 74_094]);
            expect(stackFrames[10]).toMatchStackFrame(["apply", "native", undefined, undefined, "native"]);
            expect(stackFrames[11]).toMatchStackFrame(["C", "index.android.bundle", 1, 74_126]);
            expect(stackFrames[12]).toMatchStackFrame(["N", "index.android.bundle", 1, 74_267]);
            expect(stackFrames[13]).toMatchStackFrame(["A", "index.android.bundle", 1, 74_709]);
            expect(stackFrames[14]).toMatchStackFrame(["forEach", "native", undefined, undefined, "native"]);
            expect(stackFrames[15]).toMatchStackFrame(["z", "index.android.bundle", 1, 74_642]);
            expect(stackFrames[16]).toMatchStackFrame(["anonymous", "index.android.bundle", 1, 77_747]);
            expect(stackFrames[17]).toMatchStackFrame(["_e", "index.android.bundle", 1, 127_755]);
            expect(stackFrames[18]).toMatchStackFrame(["Ne", "index.android.bundle", 1, 77_238]);
            expect(stackFrames[19]).toMatchStackFrame(["Ue", "index.android.bundle", 1, 77_571]);
            expect(stackFrames[20]).toMatchStackFrame(["receiveTouches", "index.android.bundle", 1, 122_512]);
            expect(stackFrames[21]).toMatchStackFrame(["apply", "native", undefined, undefined, "native"]);
            expect(stackFrames[22]).toMatchStackFrame(["value", "index.android.bundle", 1, 33_176]);
            expect(stackFrames[23]).toMatchStackFrame(["anonymous", "index.android.bundle", 1, 31_603]);
            expect(stackFrames[24]).toMatchStackFrame(["value", "index.android.bundle", 1, 32_776]);
            expect(stackFrames[25]).toMatchStackFrame(["value", "index.android.bundle", 1, 31_561]);
        });

        it("should parses JavaScriptCore errors", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.IOS_REACT_NATIVE_1 as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["_exampleFunction", "/home/test/project/App.js", 125, 13, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["_depRunCallbacks", "/home/test/project/node_modules/dep/index.js", 77, 45, undefined]);
            expect(stackFrames[2]).toMatchStackFrame([
                "tryCallTwo",
                "/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js",
                45,
                5,
                undefined,
            ]);
            expect(stackFrames[3]).toMatchStackFrame([
                "doResolve",
                "/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js",
                200,
                13,
                undefined,
            ]);
        });
    });

    describe("general", () => {
        it("should handle newlines in Error stack messages", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace({
                stack:
                    "Error: Problem at this\nlocation. Error code:1234\n"
                    + "    at http://path/to/file.js:47:22\n"
                    + "    at foo (http://path/to/file.js:52:15)",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 47, 22]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 52, 15]);
        });

        it("should handle spaces in Node.js stacks", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.NODE_WITH_SPACES as unknown as Error);

            expect(stackFrames).toHaveLength(8);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "/var/app/scratch/my project/index.js", 2, 9]);
            expect(stackFrames[1]).toMatchStackFrame(["Object.<anonymous>", "/var/app/scratch/my project/index.js", 2, 9]);
            expect(stackFrames[2]).toMatchStackFrame(["Module._compile", "internal/modules/cjs/loader.js", 774, 30]);
            expect(stackFrames[3]).toMatchStackFrame(["Object.Module._extensions..js", "internal/modules/cjs/loader.js", 785, 10]);
        });

        it("should handle Node.js stacks with parentheses", () => {
            expect.assertions(8);

            const stackFrames = parseStacktrace(capturedErrors.NODE_WITH_PARENTHESES as unknown as Error);

            expect(stackFrames).toHaveLength(7);
            expect(stackFrames[0]).toMatchStackFrame(["Object.<anonymous>", "/var/app/scratch/my project (top secret)/index.js", 2, 9]);
            expect(stackFrames[1]).toMatchStackFrame(["Module._compile", "internal/modules/cjs/loader.js", 774, 30]);
            expect(stackFrames[2]).toMatchStackFrame(["Object.Module._extensions..js", "internal/modules/cjs/loader.js", 785, 10]);
            expect(stackFrames[3]).toMatchStackFrame(["Module.load", "internal/modules/cjs/loader.js", 641, 32]);
            expect(stackFrames[4]).toMatchStackFrame(["Function.Module._load", "internal/modules/cjs/loader.js", 556, 12]);
            expect(stackFrames[5]).toMatchStackFrame(["Function.Module.runMain", "internal/modules/cjs/loader.js", 837, 10]);
            expect(stackFrames[6]).toMatchStackFrame(["<unknown>", "internal/main/run_main_module.js", 17, 11]);
        });

        it("should parses node error with space in path", () => {
            expect.assertions(11);

            const stackFrames = parseStacktrace(capturedErrors.NODE_SPACE as unknown as Error);

            expect(stackFrames).toHaveLength(10);
            expect(stackFrames[0]).toMatchStackFrame(["Spect.get", String.raw`C:\project files\spect\src\index.js`, 161, 26]);
            expect(stackFrames[1]).toMatchStackFrame(["Object.get", String.raw`C:\project files\spect\src\index.js`, 43, 36]);
            expect(stackFrames[2]).toMatchStackFrame(["<unknown>", "<anonymous>", undefined, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["(anonymous function).then", String.raw`C:\project files\spect\src\index.js`, 165, 33]);
            expect(stackFrames[4]).toMatchStackFrame(["process.runNextTicks [as _tickCallback]", "internal/process/task_queues.js", 52, 5]);
            expect(stackFrames[5]).toMatchStackFrame(["<unknown>", String.raw`C:\project files\spect\node_modules\esm\esm.js`, 1, 34_535]);
            expect(stackFrames[6]).toMatchStackFrame(["<unknown>", String.raw`C:\project files\spect\node_modules\esm\esm.js`, 1, 34_176]);
            expect(stackFrames[7]).toMatchStackFrame(["process.<anonymous>", String.raw`C:\project files\spect\node_modules\esm\esm.js`, 1, 34_506]);
            expect(stackFrames[8]).toMatchStackFrame(["Function.<anonymous>", String.raw`C:\project files\spect\node_modules\esm\esm.js`, 1, 296_856]);
            expect(stackFrames[9]).toMatchStackFrame(["Function.<anonymous>", String.raw`C:\project files\spect\node_modules\esm\esm.js`, 1, 296_555]);
        });

        it("should parses node.js async errors available with version 12", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace(capturedErrors.NODE_12 as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["promiseMe", "/home/xyz/hack/asyncnode.js", 11, 9]);
            expect(stackFrames[1]).toMatchStackFrame(["async main", "/home/xyz/hack/asyncnode.js", 15, 13]);
        });

        it("should parses node.js errors with <anonymous> calls as well", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.NODE_ANONYM as unknown as Error);

            expect(stackFrames).toHaveLength(10);
            expect(stackFrames[0]).toMatchStackFrame(["Spect.get", String.raw`C:\projects\spect\src\index.js`, 161, 26]);
            expect(stackFrames[3]).toMatchStackFrame(["(anonymous function).then", String.raw`C:\projects\spect\src\index.js`, 165, 33]);
            expect(stackFrames[5]).toMatchStackFrame(["<unknown>", String.raw`C:\projects\spect\node_modules\esm\esm.js`, 1, 34_535]);
            expect(stackFrames[7]).toMatchStackFrame(["process.<anonymous>", String.raw`C:\projects\spect\node_modules\esm\esm.js`, 1, 34_506]);
        });

        it("should parses anonymous sources", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace({
                stack: `x
          at new <anonymous> (http://www.example.com/test.js:2:1
          at <anonymous>:1:2`,
            } as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["new <anonymous>", "http://www.example.com/test.js", 2, 1]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "<anonymous>", 1, 2]);
        });

        it("should parses node.js errors", () => {
            expect.assertions(9);

            const stackFrames = parseStacktrace({
                stack: `ReferenceError: test is not defined
          at repl:1:2
          at REPLServer.self.eval (repl.js:110:21)
          at Interface.<anonymous> (repl.js:239:12)
          at Interface.EventEmitter.emit (events.js:95:17)
          at emitKey (readline.js:1095:12)`,
            } as unknown as Error);

            expect(stackFrames).toHaveLength(5);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "repl", 1, 2]);
            expect(stackFrames[1]).toMatchStackFrame(["REPLServer.self.eval", "repl.js", 110, 21]);
            expect(stackFrames[2]).toMatchStackFrame(["Interface.<anonymous>", "repl.js", 239, 12]);
            expect(stackFrames[3]).toMatchStackFrame(["Interface.EventEmitter.emit", "events.js", 95, 17]);
            expect(stackFrames[4]).toMatchStackFrame(["emitKey", "readline.js", 1095, 12]);

            const stackFrames2 = parseStacktrace({
                stack: `ReferenceError: breakDown is not defined
          at null._onTimeout (repl:1:25)
          at Timer.listOnTimeout [as ontimeout] (timers.js:110:15)`,
            } as unknown as Error);

            expect(stackFrames2).toHaveLength(2);
            expect(stackFrames2[0]).toMatchStackFrame(["null._onTimeout", "repl", 1, 25]);
            expect(stackFrames2[1]).toMatchStackFrame(["Timer.listOnTimeout [as ontimeout]", "timers.js", 110, 15]);
        });

        it("should parse TypeError stack", () => {
            expect.assertions(1);

            const stackFrames = parseStacktrace(new TypeError("foo"));

            expect(stackFrames).toHaveLength(10);
        });

        it("should parse Custom Error stack", () => {
            expect.assertions(1);

            // eslint-disable-next-line @typescript-eslint/naming-convention
            class xxx1Error extends TypeError {}

            // eslint-disable-next-line new-cap
            const stackFrames = parseStacktrace(new xxx1Error("foo"));

            expect(stackFrames).toHaveLength(10);
        });

        it("should parse Travis Error", () => {
            expect.assertions(2);

            const stackFrames = parseStacktrace({
                stack: `Error: foo
     at extensions.(anonymous function) (a.js:13:11)`,
            } as unknown as Error);

            expect(stackFrames).toHaveLength(1);
            expect(stackFrames[0]).toMatchStackFrame(["extensions.(anonymous function)", "a.js", 13, 11]);
        });

        it("should parse a eval Error", () => {
            expect.assertions(3);

            // eslint-disable-next-line no-eval
            const stackFrames = parseStacktrace(eval("new Error(\"foo:eval\")"));

            expect(stackFrames).toHaveLength(10);
            expect(stackFrames[0]).toMatchStackFrame([
                "eval",
                `${dirname(fileURLToPath(import.meta.url))}${isWin ? "\\" : "/"}parse-stacktrace.test.ts`,
                1287,
                49,
                "eval",
                { column: 1, file: "<anonymous>", line: 1, methodName: "eval", type: "eval" },
            ]);
            expect(stackFrames[1]).toMatchStackFrame([
                "<unknown>",
                `${dirname(fileURLToPath(import.meta.url))}${isWin ? "\\" : "/"}parse-stacktrace.test.ts`,
                1287,
                49,
            ]);
        });

        it("should parses PhantomJS 1.19 error", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.PHANTOMJS_1_19 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "file:///path/to/file.js", 878, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 4283, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 4287, undefined]);
        });

        it("should parse regular expression in error stacktrace", () => {
            expect.assertions(11);

            const stackFrames = parseStacktrace(
                {
                    stack: `    error("Warning: Received \`%s\` for a non-boolean attribute \`%s\`.

If you want to write it to the DOM, pass a string instead: %s="%s" or %s={value.toString()}.

If you used to conditionally omit it with %s={condition && value}, pass %s={condition ? value : undefined} instead.%s", "false", "loading", "loading", "false", "loading", "loading", "loading", "
    in button (created by Context.Consumer)
        in StyledButton (at overrideOptional.tsx:16)
            in Overridable(StyledButton) (at Button.tsx:108)
                in Button (created by Context.Consumer)
                    in StyledButton (at Button.tsx:51)
                        in ButtonWithArrow (at overrideOptional.tsx:16)
                            in Overridden(Button) (created by Context.Consumer)
                                in ButtonPrimary (at overrideOptional.tsx:16)
                                    in Overridden(Styled(Overridable(Button))) (at Submit.tsx:7)
                                        in Submit (at AddToCartForm.tsx:98)
                                            in form (created by Form)
                                                in FormProvider (created by Form)
                                                    in Form (at AddToCartForm.tsx:97)
                                                        in AddToCartForm (at ProductAddToCartForm.tsx:68)
                                                            in ProductAddToCartForm (at ProductPageInfoSide.tsx:244)
                                                                in div (created by Context.Consumer)
                                                                    in Card (at ProductPageInfoSide.tsx:153)
                                                                        in div (created by Context.Consumer)
                                                                            in ProductInfo (at ProductPageInfoSide.tsx:152)
                                                                                in ProductPageInfoSide (at ProductPage.tsx:194)
                                                                                    in div (created by Context.Consumer)
                                                                                        in ProductTop (at ProductPage.tsx:173)
                                                                                            in div (created by Context.Consumer)
                                                                                                in Wrapper (at Container.tsx:114)
                                                                                                    in ForwardRef(_c) (at ProductPage.tsx:166)
                                                                                                        in article (at ProductPage.tsx:165)
                                                                                                            in main (created by Context.Consumer)
                                                                                                                in Content (at PageWrapper.tsx:74)
                                                                                                                    in div (created by Context.Consumer)
                                                                                                                        in Page (at PageWrapper.tsx:65)
                                                                                                                            in PortalTarget (at PageWrapper.tsx:64)
                                                                                                                                in PageWrapper (at ProductPage.tsx:156)
                                                                                                                                    in ProductPage (at overrideOptional.tsx:16)
                                                                                                                                        in Overridable(ProductPage) (at DynamicRouteResolver.tsx:54)
                                                                                                                                            in DynamicRouteResolver (created by Context.Consumer)
                                                                                                                                                in Route (at AppRouter.tsx:25)
                                                                                                                                                    in Switch (at AppRouter.tsx:14)
                                                                                                                                                        in AppRouter (at App.tsx:32)
                                                                                                                                                            in BreakpointsProvider (at AppProviders.tsx:38)
                                                                                                                                                                in ApolloProvider (at ApolloConnector.tsx:68)
                                                                                                                                                                    in ApolloConnector (at AppProviders.tsx:30)
                                                                                                                                                                        in Router (at RouterProvider.tsx:18)
                                                                                                                                                                            in RouterProvider (at AppProviders.tsx:29)
                                                                                                                                                                                in StoreViewProvider (at AppProviders.tsx:25)
                                                                                                                                                                                    in ErrorBoundary (at RootErrorBoundary.tsx:105)
                                                                                                                                                                                        in RootErrorBoundary (at AppProviders.tsx:24)
                                                                                                                                                                                            in I18nProvider (at I18nLoader.tsx:19)
                                                                                                                                                                                                in I18nLoader (at AppProviders.tsx:23)
                                                                                                                                                                                                    in AppProviders (at App.tsx:28)
                                                                                                                                                                                                        in App (at src/index.tsx:30) at console.error (http://localhost:3340/__cypress/runner/cypress_runner.js:140661:26)
`,
                } as unknown as Error,
                {
                    frameLimit: 55,
                },
            );

            expect(stackFrames).toHaveLength(38);
            expect(stackFrames[0]).toMatchStackFrame(["StyledButton", "overrideOptional.tsx", 16, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["Overridable(StyledButton)", "Button.tsx", 108, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["StyledButton", "Button.tsx", 51, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["ButtonWithArrow", "overrideOptional.tsx", 16, undefined]);
            expect(stackFrames[4]).toMatchStackFrame(["ButtonPrimary", "overrideOptional.tsx", 16, undefined]);
            expect(stackFrames[5]).toMatchStackFrame(["Overridden(Styled(Overridable(Button)))", "Submit.tsx", 7, undefined]);
            expect(stackFrames[6]).toMatchStackFrame(["Submit", "AddToCartForm.tsx", 98, undefined]);
            expect(stackFrames[7]).toMatchStackFrame(["Form", "AddToCartForm.tsx", 97, undefined]);
            expect(stackFrames[36]).toMatchStackFrame(["AppProviders", "App.tsx", 28, undefined]);
            expect(stackFrames[37]).toMatchStackFrame(["App", "src/index.tsx", 30, undefined]);
        });

        it("should parse found in the wild stack trace", () => {
            expect.assertions(3);

            const stackFrames = parseStacktrace({
                stack: `
            spy() at Object.<anonymous> (/projects/preact/test-utils/test/shared/act.test.js:50:20 <- test-utils/test/shared/act.test.js:1245:18)
            warn('getting vnode.attributes is deprecated, use vnode.props') => 1 at Object.get (/projects/preact/debug/src/debug.js:271:13 <- debug/test/browser/debug.test.js:2052:21)
`,
            } as unknown as Error);

            expect(stackFrames).toHaveLength(2);
            expect(stackFrames[0]).toMatchStackFrame(["Object.<anonymous>", "/projects/preact/test-utils/test/shared/act.test.js", 50, 20]);
            expect(stackFrames[1]).toMatchStackFrame(["Object.get", "/projects/preact/debug/src/debug.js", 271, 13]);
        });

        it("should parse SecurityError", () => {
            expect.assertions(13);

            const SECURITY_ERROR = {
                message: "Blocked a frame with origin \"https://SENTRY_URL.sentry.io\" from accessing a cross-origin frame.",
                name: "SecurityError",
                stack:
                    "SecurityError: Blocked a frame with origin \"https://SENTRY_URL.sentry.io\" from accessing a cross-origin frame.\n"
                    + "   at Error: Blocked a frame with origin \"(https://SENTRY_URL.sentry.io\" from accessing a cross-origin frame.)\n"
                    + "   at castFn(../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js:368:76)\n"
                    + "   at castFn(../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js:409:17)\n"
                    + "   at Replayer.applyEventsSynchronously(../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js:325:13)\n"
                    + "   at <object>.actions.play(../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/machine.js:132:17)\n"
                    + "   at <anonymous>(../node_modules/@sentry-internal/rrweb/es/rrweb/ext/@xstate/fsm/es/index.js:15:2595)\n"
                    + "   at Array.forEach(<anonymous>)\n"
                    + "   at l(../node_modules/@sentry-internal/rrweb/es/rrweb/ext/@xstate/fsm/es/index.js:15:2551)\n"
                    + "   at c.send(../node_modules/@sentry-internal/rrweb/es/rrweb/ext/@xstate/fsm/es/index.js:15:2741)\n"
                    + "   at Replayer.play(../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js:220:26)\n"
                    + "   at Replayer.pause(../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js:235:18)\n"
                    + "   at playTimer.current(./app/components/replays/replayContext.tsx:397:62)\n"
                    + "   at sentryWrapped(../node_modules/@sentry/browser/esm/helpers.js:90:17)",
            };

            const stackFrames = parseStacktrace(SECURITY_ERROR as unknown as Error);

            expect(stackFrames).toHaveLength(12);
            expect(stackFrames[0]).toMatchStackFrame(["castFn", "../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js", 368, 76]);
            expect(stackFrames[1]).toMatchStackFrame(["castFn", "../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js", 409, 17]);
            expect(stackFrames[2]).toMatchStackFrame([
                "Replayer.applyEventsSynchronously",
                "../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js",
                325,
                13,
            ]);
            expect(stackFrames[3]).toMatchStackFrame([
                "<object>.actions.play",
                "../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/machine.js",
                132,
                17,
            ]);
            expect(stackFrames[4]).toMatchStackFrame(["<anonymous>", "../node_modules/@sentry-internal/rrweb/es/rrweb/ext/@xstate/fsm/es/index.js", 15, 2595]);
            expect(stackFrames[5]).toMatchStackFrame(["Array.forEach", "<anonymous>", undefined, undefined]);
            expect(stackFrames[6]).toMatchStackFrame(["l", "../node_modules/@sentry-internal/rrweb/es/rrweb/ext/@xstate/fsm/es/index.js", 15, 2551]);
            expect(stackFrames[7]).toMatchStackFrame(["c.send", "../node_modules/@sentry-internal/rrweb/es/rrweb/ext/@xstate/fsm/es/index.js", 15, 2741]);
            expect(stackFrames[8]).toMatchStackFrame([
                "Replayer.play",
                "../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js",
                220,
                26,
            ]);
            expect(stackFrames[9]).toMatchStackFrame([
                "Replayer.pause",
                "../node_modules/@sentry-internal/rrweb/es/rrweb/packages/rrweb/src/replay/index.js",
                235,
                18,
            ]);
            expect(stackFrames[10]).toMatchStackFrame(["playTimer.current", "./app/components/replays/replayContext.tsx", 397, 62]);
            expect(stackFrames[11]).toMatchStackFrame(["sentryWrapped", "../node_modules/@sentry/browser/esm/helpers.js", 90, 17]);
        });
    });

    describe("opera", () => {
        // Opera v15 was released in 2013 and was based on Chromium.
        // Release 15/10/2014
        it("should parse Opera 25 Error stacks", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.OPERA_25 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 47, 22]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 52, 15]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "http://path/to/file.js", 108, 168]);
        });
    });

    describe("webkit/safari", () => {
        it("should match stack trace #1", () => {
            expect.assertions(7);

            const stackFrames = parseStacktrace({
                stack:
                    "AssertionError@http://localhost:8000/node_modules/chai/chai.js:9449:22\n"
                    + "http://localhost:8000/node_modules/chai/chai.js:239:31\n"
                    + "assertEqual@http://localhost:8000/node_modules/chai/chai.js:1387:18\n"
                    + "methodWrapper@http://localhost:8000/node_modules/chai/chai.js:7824:30\n"
                    + "[native code]\n"
                    + "http://localhost:8000/mytest.test.js?wtr-session-id=05c3d9b6-ea4b-467b-ac23-de275675ee27:13:46\n",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(6);
            expect(stackFrames[0]).toMatchStackFrame(["AssertionError", "http://localhost:8000/node_modules/chai/chai.js", 9449, 22]);
            expect(stackFrames[1]).toMatchStackFrame(["<unknown>", "http://localhost:8000/node_modules/chai/chai.js", 239, 31]);
            expect(stackFrames[2]).toMatchStackFrame(["assertEqual", "http://localhost:8000/node_modules/chai/chai.js", 1387, 18]);
            expect(stackFrames[3]).toMatchStackFrame(["methodWrapper", "http://localhost:8000/node_modules/chai/chai.js", 7824, 30]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[5]).toMatchStackFrame([
                "<unknown>",

                "http://localhost:8000/mytest.test.js?wtr-session-id=05c3d9b6-ea4b-467b-ac23-de275675ee27",
                13,
                46,
            ]);
        });

        it("should match stack trace of module execution", () => {
            expect.assertions(8);

            const stackFrames = parseStacktrace({
                stack:
                    "module code@http://localhost:8000/my-test.js:1:16\n"
                    + "evaluate@[native code]\n"
                    + "moduleEvaluation@[native code]\n"
                    + "moduleEvaluation@[native code]\n"
                    + "[native code]\n"
                    + "promiseReactionJobWithoutPromise@[native code]\n"
                    + "promiseReactionJob@[native code]",
            } as unknown as Error);

            expect(stackFrames).toHaveLength(7);
            expect(stackFrames[0]).toMatchStackFrame(["module code", "http://localhost:8000/my-test.js", 1, 16]);
            expect(stackFrames[1]).toMatchStackFrame(["evaluate", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[2]).toMatchStackFrame(["moduleEvaluation", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[3]).toMatchStackFrame(["moduleEvaluation", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[5]).toMatchStackFrame(["promiseReactionJobWithoutPromise", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[6]).toMatchStackFrame(["promiseReactionJob", "[native code]", undefined, undefined, "native"]);
        });

        it("should parse Safari 6 Error.stack", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.SAFARI_6 as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 48, undefined]);
            expect(stackFrames[1]).toMatchStackFrame(["dumpException3", "http://path/to/file.js", 52, undefined]);
            expect(stackFrames[2]).toMatchStackFrame(["onclick", "http://path/to/file.js", 82, undefined]);
            expect(stackFrames[3]).toMatchStackFrame(["<unknown>", "[native code]", undefined, undefined, "native"]);
        });

        it("should parse Safari 7 Error.stack", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.SAFARI_7 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 48, 22]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 52, 15]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "http://path/to/file.js", 108, 107]);
        });

        it("should parse Safari 8 Error.stack", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.SAFARI_8 as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "http://path/to/file.js", 47, 22]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 52, 15]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "http://path/to/file.js", 108, 23]);
        });

        it("should parses Safari 8 eval error", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.SAFARI_8_EVAL as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["eval", "[native code]", 1, 18, "native"]);
            expect(stackFrames[1]).toMatchStackFrame(["foo", "http://path/to/file.js", 58, 21]);
            expect(stackFrames[2]).toMatchStackFrame(["bar", "http://path/to/file.js", 109, 91]);
        });

        it("should parse nested eval() from Safari 9", () => {
            expect.assertions(4);

            const stackFrames = parseStacktrace(capturedErrors.SAFARI_9_NESTED_EVAL as unknown as Error);

            expect(stackFrames).toHaveLength(3);
            expect(stackFrames[0]).toMatchStackFrame(["eval", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[1]).toMatchStackFrame(["speak", "http://localhost:8080/file.js", 26, 21]);
            expect(stackFrames[2]).toMatchStackFrame(["global code", "http://localhost:8080/file.js", 33, 18]);
        });

        it("should parse exceptions with native code frames in Safari 12", () => {
            expect.assertions(5);

            const stackFrames = parseStacktrace(capturedErrors.SAFARI_12_NATIVE_CODE_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(4);
            expect(stackFrames[0]).toMatchStackFrame(["fooIterator", "http://localhost:5000/test", 20, 26]);
            expect(stackFrames[1]).toMatchStackFrame(["map", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[2]).toMatchStackFrame(["foo", "http://localhost:5000/test", 19, 22]);
            expect(stackFrames[3]).toMatchStackFrame(["global code", "http://localhost:5000/test", 24, 10]);
        });

        it("should parse exceptions with eval frames in Safari 12", () => {
            expect.assertions(12);

            const stackFrames = parseStacktrace(capturedErrors.SAFARI_12_EVAL_EXCEPTION as unknown as Error);

            expect(stackFrames).toHaveLength(11);
            expect(stackFrames[0]).toMatchStackFrame(["aha", "http://localhost:5000/", 19, 22]);
            expect(stackFrames[1]).toMatchStackFrame(["aha", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[2]).toMatchStackFrame(["callAnotherThing", "http://localhost:5000/", 20, 16]);
            expect(stackFrames[3]).toMatchStackFrame(["callback", "http://localhost:5000/", 25, 23]);
            expect(stackFrames[4]).toMatchStackFrame(["<unknown>", "http://localhost:5000/", 34, 25]);
            expect(stackFrames[5]).toMatchStackFrame(["map", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[6]).toMatchStackFrame(["test", "http://localhost:5000/", 33, 26]);
            expect(stackFrames[7]).toMatchStackFrame(["eval", "[native code]", undefined, undefined, "native"]);
            expect(stackFrames[8]).toMatchStackFrame(["aha", "http://localhost:5000/", 39, 9]);
            expect(stackFrames[9]).toMatchStackFrame(["testMethod", "http://localhost:5000/", 44, 10]);
            expect(stackFrames[10]).toMatchStackFrame(["<unknown>", "http://localhost:5000/", 50, 29]);
        });

        describe("safari extensions", () => {
            it("should parse exceptions for safari-extension", () => {
                expect.assertions(3);

                const stackFrames = parseStacktrace(capturedErrors.SAFARI_EXTENSION_EXCEPTION as unknown as Error);

                expect(stackFrames).toHaveLength(2);
                expect(stackFrames[0]).toMatchStackFrame([
                    "ClipperError",

                    "safari-extension://3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/commons.js",
                    223_036,
                    10,
                ]);
                expect(stackFrames[1]).toMatchStackFrame([
                    "<unknown>",
                    "safari-extension://3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/topee-content.js",
                    3313,
                    26,
                ]);
            });

            it("should parse exceptions for safari-extension with frames-only stack", () => {
                expect.assertions(4);

                const stackFrames = parseStacktrace(capturedErrors.SAFARI_EXTENSION_EXCEPTION_2 as unknown as Error);

                expect(stackFrames).toHaveLength(3);
                expect(stackFrames[0]).toMatchStackFrame([
                    "isClaimed",

                    "safari-extension://com.grammarly.safari.extension.ext2-W8F64X92K3/ee7759dd/Grammarly.js",
                    2,
                    929_865,
                ]);
                expect(stackFrames[1]).toMatchStackFrame([
                    "<unknown>",

                    "safari-extension://com.grammarly.safari.extension.ext2-W8F64X92K3/ee7759dd/Grammarly.js",
                    2,
                    1_588_410,
                ]);
                expect(stackFrames[2]).toMatchStackFrame(["promiseReactionJob", "[native code]", undefined, undefined, "native"]);
            });

            it("should parse exceptions for safari-web-extension", () => {
                expect.assertions(3);

                const stackFrames = parseStacktrace(capturedErrors.SAFARI_WEB_EXTENSION_EXCEPTION as unknown as Error);

                expect(stackFrames).toHaveLength(2);
                expect(stackFrames[0]).toMatchStackFrame([
                    "ClipperError",

                    "safari-web-extension://3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/commons.js",
                    223_036,
                    10,
                ]);
                expect(stackFrames[1]).toMatchStackFrame([
                    "<unknown>",

                    "safari-web-extension://3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/topee-content.js",
                    3313,
                    26,
                ]);
            });

            it("should parse exceptions for safari-web-extension with frames-only stack", () => {
                expect.assertions(3);

                const stackFrames = parseStacktrace(capturedErrors.SAFARI_EXTENSION_EXCEPTION_3 as unknown as Error);

                expect(stackFrames).toHaveLength(3);
                expect(stackFrames[0]).toMatchStackFrame([
                    "p_",

                    "safari-web-extension://46434E60-F5BD-48A4-80C8-A422C5D16897/scripts/content-script.js",
                    29,
                    33_314,
                ]);
                expect(stackFrames[1]).toMatchStackFrame([
                    "<unknown>",

                    "safari-web-extension://46434E60-F5BD-48A4-80C8-A422C5D16897/scripts/content-script.js",
                    29,
                    56_027,
                ]);
            });
        });
    });

    it.skipIf(!globalThis.AggregateError)("should parse AggregateError stack", () => {
        expect.assertions(2);

        const stackFrames = parseStacktrace(new AggregateError([new Error("foo"), new Error("bar"), new Error("baz")], "test"));

        expect(stackFrames).toHaveLength(10);
        expect(stackFrames[0]).toMatchStackFrame([
            "<unknown>",
            `${dirname(fileURLToPath(import.meta.url))}${isWin ? "\\" : "/"}parse-stacktrace.test.ts`,
            1722,
            45,
        ]);
    });

    it.skipIf(!globalThis.AggregateError)("should parse AggregateError stack with empty message", () => {
        expect.assertions(2);

        // eslint-disable-next-line unicorn/error-message
        const stackFrames = parseStacktrace(new AggregateError([new Error("foo"), new Error("bar"), new Error("baz")]));

        expect(stackFrames).toHaveLength(10);
        expect(stackFrames[0]).toMatchStackFrame([
            "<unknown>",
            `${dirname(fileURLToPath(import.meta.url))}${isWin ? "\\" : "/"}parse-stacktrace.test.ts`,
            1737,
            45,
        ]);
    });

    it.skipIf(!globalThis.AggregateError)("should parse AggregateError stack with nested AggregateError", () => {
        expect.assertions(2);

        // eslint-disable-next-line unicorn/error-message
        const nestedError = new AggregateError([new Error("Nested Error")]);

        // eslint-disable-next-line unicorn/error-message
        const stackFrames = parseStacktrace(new AggregateError([nestedError]));

        expect(stackFrames).toHaveLength(10);
        expect(stackFrames[0]).toMatchStackFrame([
            "<unknown>",
            `${dirname(fileURLToPath(import.meta.url))}${isWin ? "\\" : "/"}parse-stacktrace.test.ts`,
            1755,
            45,
        ]);
    });

    it("should parse a stack trace with a single frame", () => {
        expect.assertions(2);

        const stackFrames = parseStacktrace({
            stack: "Error\n    at <anonymous>:1:1",
        } as unknown as Error);

        expect(stackFrames).toHaveLength(1);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", "<anonymous>", 1, 1]);
    });

    it("should parse a stack trace with frameLimit set to 1", () => {
        expect.assertions(2);

        const stackFrames = parseStacktrace(
            {
                stack:
                    "Error: Default error\n"
                    + "    at dumpExceptionError (http://localhost:8080/file.js:41:27)\n"
                    + "    at dumpExceptionError (http://localhost:8080/file.js:50:21)\n",
            } as unknown as Error,
            {
                frameLimit: 1,
            },
        );

        expect(stackFrames).toHaveLength(1);
        expect(stackFrames[0]).toMatchStackFrame(["dumpExceptionError", "http://localhost:8080/file.js", 41, 27]);
    });

    it("should parse a stack trace with a custom error", () => {
        expect.assertions(2);

        const stackFrames = parseStacktrace(
            new VisulimaError({
                message: "Visulima error message",
                name: "VisulimaError",
            }),
        );

        expect(stackFrames).toHaveLength(10);
        expect(stackFrames[0]).toMatchStackFrame([
            "<unknown>",
            `${dirname(fileURLToPath(import.meta.url))}${isWin ? "\\" : "/"}parse-stacktrace.test.ts`,
            1800,
            13,
        ]);
    });

    it("should parse a stack trace with a custom error name", () => {
        expect.assertions(2);

        const error = new Error("error message");

        error.name = "Database";

        const stackFrames = parseStacktrace(error);

        expect(stackFrames).toHaveLength(10);
        expect(stackFrames[0]).toMatchStackFrame([
            "<unknown>",
            `${dirname(fileURLToPath(import.meta.url))}${isWin ? "\\" : "/"}parse-stacktrace.test.ts`,
            1818,
            23,
        ]);
    });

    it("should not create a stacktrace if the stack is broken", () => {
        expect.assertions(1);

        const stackFrames = parseStacktrace({
            stack: "Error\n no such file or directory, rename '/home/prisis/visulima/visulima/packages/is-ansi-color-supported/package.json.tmp' -> '/home/prisis/visulima/visulima/packages/is-ansi-color-supported/package.json'",
        } as unknown as Error);

        expect(stackFrames).toHaveLength(0);
    });
});
