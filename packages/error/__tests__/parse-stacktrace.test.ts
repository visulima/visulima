import { describe, expect, it } from "vitest";

import capturedErrors from "../__fixtures__/captured-errors";
import { parseStacktrace } from "../src";

describe("parse-stacktrace", () => {
    it("should parses Firefox errors with resource: URLs", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_50_RESOURCE_URL as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["render", [], "resource://path/data/content/bundle.js", 5529, 16, false, false, false]);
    });

    // Release 2018
    it("should parse stack traces with @ in the URL", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_60_URL_WITH_AT_SIGN as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(["who", [], "http://localhost:5000/misc/@stuff/foo.js", 3, 9, false, false, false]);
        expect(stackFrames[1]).toMatchStackFrame(["what", [], "http://localhost:5000/misc/@stuff/foo.js", 6, 3, false, false, false]);
        expect(stackFrames[2]).toMatchStackFrame(["where", [], "http://localhost:5000/misc/@stuff/foo.js", 9, 3, false, false, false]);
        expect(stackFrames[3]).toMatchStackFrame(["why", [], "https://localhost:5000/misc/@stuff/foo.js", 12, 3, false, false, false]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "http://localhost:5000/misc/@stuff/foo.js", 15, 1, false, false, false]);
    });

    // Release 2018
    it("should parse stack traces with @ in the URL and the method", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_60_URL_AND_FUNCTION_NAME_WITH_AT_SIGN as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(['obj["@who"]', [], "http://localhost:5000/misc/@stuff/foo.js", 4, 9, false, false, false]);
        expect(stackFrames[1]).toMatchStackFrame(["what", [], "http://localhost:5000/misc/@stuff/foo.js", 8, 3, false, false, false]);
    });

    it("should parse V8 Error.stack", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_15 as unknown as Error);

        expect(stackFrames).toHaveLength(4);
        expect(stackFrames[0]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 13, 17, false, false]);
        expect(stackFrames[1]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 16, 5, false, false]);
        expect(stackFrames[2]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 20, 5, false, false]);
        expect(stackFrames[3]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 24, 4, false, false]);
    });

    it("should parse and set eval origin for eval() from V8", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_58_EVAL as unknown as Error);

        expect(stackFrames).toHaveLength(6);
        expect(stackFrames[0]).toMatchStackFrame([
            "willThrow",
            undefined,
            "index.js",
            11,
            undefined,
            false,
            false,
            undefined,
            ["eval", undefined, "<anonymous>", 3, 3, undefined, true],
        ]);
        expect(stackFrames[1]).toMatchStackFrame([
            "eval",
            undefined,
            "index.js",
            11,
            undefined,
            false,
            false,
            undefined,
            ["eval", undefined, "<anonymous>", 6, 1, undefined, true],
        ]);
        expect(stackFrames[2]).toMatchStackFrame(["h", undefined, "index.js", 11, undefined]);
        expect(stackFrames[3]).toMatchStackFrame(["g", undefined, "index.js", 6, undefined]);
        expect(stackFrames[4]).toMatchStackFrame(["f", undefined, "index.js", 2, undefined]);
        expect(stackFrames[5]).toMatchStackFrame(["<unknown>", undefined, "index.js", 23, undefined]);
    });

    it("should parse V8 entries with no location", () => {
        const stackFrames = parseStacktrace({ stack: "Error\n at Array.forEach (native)" } as unknown as Error);

        expect(stackFrames).toHaveLength(1);
        expect(stackFrames[0]).toMatchStackFrame(["Array.forEach", ["native"], undefined, undefined, undefined, true, false]);
    });

    it("should parse V8 Error.stack entries with port numbers", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_36 as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(["dumpExceptionError", [], "http://localhost:8080/file.js", 41, 27]);
    });

    it("should parse error stacks with Constructors", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_46 as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(["new CustomError", [], "http://localhost:8080/file.js", 41, 27]);
        expect(stackFrames[1]).toMatchStackFrame(["HTMLButtonElement.onclick", [], "http://localhost:8080/file.js", 107, 146]);
    });

    it("should parse nested eval() from V8", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_48_NESTED_EVAL as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame([
            "baz",
            [],
            "http://localhost:8080/file.js",
            21,
            17,
            false,
            true,
            undefined,
            ["foo", [], "<anonymous>", 1, 30, false, true, undefined, ["eval", undefined, "http://localhost:8080/file.js", 21, 17, undefined, true]],
        ]);
        expect(stackFrames[1]).toMatchStackFrame([
            "foo",
            [],
            "http://localhost:8080/file.js",
            21,
            17,
            false,
            true,
            undefined,
            ["speak", [], "<anonymous>", 2, 96, undefined, true],
        ]);
        expect(stackFrames[2]).toMatchStackFrame([
            "eval",
            [],
            "http://localhost:8080/file.js",
            21,
            17,
            false,
            true,
            ["speak", [], "<anonymous>", 4, 18, undefined, true]
        ]);
        expect(stackFrames[3]).toMatchStackFrame(["Object.speak", [], "http://localhost:8080/file.js", 21, 17]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "http://localhost:8080/file.js", 31, 13]);
    });

    it("should parses Chrome 76 error with async support", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_76 as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(["bar", [], "<anonymous>", 8, 9]);
        expect(stackFrames[1]).toMatchStackFrame(["async foo", [], "<anonymous>", 2, 3]);
    });

    it("should parses Chrome error with webpack URLs", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_XX_WEBPACK as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(["TESTTESTTEST.eval", [], "webpack:///./src/components/test/test.jsx?", 295, 108]);
        expect(stackFrames[1]).toMatchStackFrame(["TESTTESTTEST.render", [], "webpack:///./src/components/test/test.jsx?", 272, 32]);
        expect(stackFrames[2]).toMatchStackFrame(["TESTTESTTEST.tryRender", [], "webpack:///./~/react-transform-catch-errors/lib/index.js?", 34, 31]);
        expect(stackFrames[3]).toMatchStackFrame(["TESTTESTTEST.proxiedMethod", [], "webpack:///./~/react-proxy/modules/createPrototypeProxy.js?", 44, 30]);
        expect(stackFrames[4]).toMatchStackFrame(["Module../pages/index.js", [], "C:\\root\\server\\development\\pages\\index.js", 182, 7]);
    });

    it("should parses Chrome error with blob URLs", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_48_BLOB as unknown as Error);

        expect(stackFrames).toHaveLength(7);
        expect(stackFrames[1]).toMatchStackFrame(["s", [], "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 31, 29_146]);
        expect(stackFrames[2]).toMatchStackFrame(["Object.d [as add]", [], "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 31, 30_039]);
        // eslint-disable-next-line no-secrets/no-secrets
        expect(stackFrames[3]).toMatchStackFrame(["<unknown>", [], "blob:http%3A//localhost%3A8080/d4eefe0f-361a-4682-b217-76587d9f712a", 15, 10_978]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 1, 6911]);
        expect(stackFrames[5]).toMatchStackFrame(["n.fire", [], "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 7, 3019]);
        expect(stackFrames[6]).toMatchStackFrame(["n.handle", [], "blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379", 7, 2863]);
    });

    // Release 2012
    it("should parse IE 10 Error stacks", () => {
        const stackFrames = parseStacktrace(capturedErrors.IE_10 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["Anonymous function", [], "http://path/to/file.js", 48, 13]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 46, 9]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 82, 1]);
    });

    // Release 2013
    it("should parse IE 11 Error stacks", () => {
        const stackFrames = parseStacktrace(capturedErrors.IE_11 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["Anonymous function", [], "http://path/to/file.js", 47, 21]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 45, 13]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 108, 1]);
    });

    // Release 2013
    it("should parses IE 11 eval error", () => {
        const stackFrames = parseStacktrace(capturedErrors.IE_11_EVAL as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["eval code", [], "eval code", 1, 1, false, true]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 58, 17]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 109, 1]);
    });

    // Release 2015
    it("should parse nested eval() from Edge", () => {
        const stackFrames = parseStacktrace(capturedErrors.EDGE_20_NESTED_EVAL as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(["baz", [], "eval code", 1, 18, false, true]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "eval code", 2, 90, false, true]);
        expect(stackFrames[2]).toMatchStackFrame(["eval code", [], "eval code", 4, 18, false, true]);
        expect(stackFrames[3]).toMatchStackFrame(["speak", [], "http://localhost:8080/file.js", 25, 17]);
        expect(stackFrames[4]).toMatchStackFrame(["Global code", [], "http://localhost:8080/file.js", 32, 9]);
    });

    // Release 15/10/2014
    it("should parse Opera 25 Error stacks", () => {
        const stackFrames = parseStacktrace(capturedErrors.OPERA_25 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 47, 22]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 52, 15]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 108, 168]);
    });

    it("should parses PhantomJS 1.19 error", () => {
        const stackFrames = parseStacktrace(capturedErrors.PHANTOMJS_1_19 as unknown as Error);
        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "file:///path/to/file.js", 878, undefined]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 4283, undefined]);
        expect(stackFrames[2]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 4287, undefined]);
    });

    it("should handle newlines in Error stack messages", () => {
        const stackFrames = parseStacktrace({
            stack:
                // eslint-disable-next-line no-useless-concat
                "Error: Problem at this\nlocation. Error code:1234\n" + "    at http://path/to/file.js:47:22\n" + "    at foo (http://path/to/file.js:52:15)",
        } as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 47, 22]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 52, 15]);
    });

    it("should handle webpack error stack", () => {
        const stackFrames = parseStacktrace({
            stack:
                "at tryRunOrWebpackError (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/HookWebpackError.js:88:9)\n" +
                "at __webpack_require_module__ (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:5051:12)\n" +
                "at __webpack_require__ (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:5008:18)\n" +
                // eslint-disable-next-line no-secrets/no-secrets
                "at /usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:5079:20\n" +
                "at symbolIterator (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js:3485:9)\n" +
                "at done (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js:3527:9)\n" +
                "at Hook.eval [as callAsync] (eval at create (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/HookCodeFactory.js:33:10), <anonymous>:15:1)\n" +
                "at Hook.CALL_ASYNC_DELEGATE [as _callAsync] (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/Hook.js:18:14)\n" +
                // eslint-disable-next-line no-secrets/no-secrets
                "at /usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js:4986:43\n" +
                "at symbolIterator (/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js:3482:9)\n",
        } as unknown as Error);

        expect(stackFrames).toHaveLength(10);

        expect(stackFrames[0]).toMatchStackFrame([
            "tryRunOrWebpackError",
            [],
            // eslint-disable-next-line no-secrets/no-secrets
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/HookWebpackError.js",
            88,
            9,
        ]);
        expect(stackFrames[1]).toMatchStackFrame([
            "__webpack_require_module__",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
            5051,
            12,
        ]);
        expect(stackFrames[2]).toMatchStackFrame([
            "__webpack_require__",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
            5008,
            18,
        ]);
        expect(stackFrames[3]).toMatchStackFrame([
            "<unknown>",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
            5079,
            20,
        ]);
        expect(stackFrames[4]).toMatchStackFrame([
            "symbolIterator",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js",
            3485,
            9,
        ]);
        expect(stackFrames[5]).toMatchStackFrame([
            "done",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js",
            3527,
            9,
        ]);
        expect(stackFrames[6]).toMatchStackFrame([
            "Hook.eval [as callAsync]",
            [],
            // eslint-disable-next-line no-secrets/no-secrets
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/HookCodeFactory.js",
            33,
            10,
            false,
            true,
        ]);
        expect(stackFrames[7]).toMatchStackFrame([
            "Hook.CALL_ASYNC_DELEGATE [as _callAsync]",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/Hook.js",
            18,
            14,
        ]);
        expect(stackFrames[8]).toMatchStackFrame([
            "<unknown>",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/webpack/lib/Compilation.js",
            4986,
            43,
        ]);
        expect(stackFrames[9]).toMatchStackFrame([
            "symbolIterator",
            [],
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/neo-async/async.js",
            3482,
            9,
        ]);
    });

    it("should handle webpack eval stacks", () => {
        const stackFrames = parseStacktrace({
            stack:
                "ReferenceError: chilxdren is not defined\n" +
                "at new Layout (webpack:///./src/Layout.js?:25:5)\n" +
                "at eval (webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?:90:24)\n" +
                "at instantiate (webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?:98:9)\n" +
                "at Layout (eval at proxyClass (webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?), <anonymous>:4:17)\n" +
                "at ReactCompositeComponentMixin.mountComponent (webpack:///./~/react/lib/ReactCompositeComponent.js?:170:18)\n" +
                "at wrapper [as mountComponent] (webpack:///./~/react/lib/ReactPerf.js?:66:21)\n" +
                "at Object.ReactReconciler.mountComponent (webpack:///./~/react/lib/ReactReconciler.js?:39:35)\n" +
                "at ReactCompositeComponentMixin.performInitialMount (webpack:///./~/react/lib/ReactCompositeComponent.js?:289:34)\n" +
                "at ReactCompositeComponentMixin.mountComponent (webpack:///./~/react/lib/ReactCompositeComponent.js?:237:21)\n" +
                "at wrapper [as mountComponent] (webpack:///./~/react/lib/ReactPerf.js?:66:21)\n",
        } as unknown as Error);

        expect(stackFrames).toHaveLength(10);
        expect(stackFrames[0]).toMatchStackFrame(["new Layout", [], "webpack:///./src/Layout.js?", 25, 5]);
        expect(stackFrames[1]).toMatchStackFrame([
            "eval",
            [],
            "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?",
            90,
            24,
            false,
            true,
        ]);
        expect(stackFrames[2]).toMatchStackFrame(["instantiate", [], "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?", 98, 9]);
        expect(stackFrames[3]).toMatchStackFrame([
            "Layout",
            [],
            "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?",
            undefined,
            undefined,
            false,
            false,
            undefined,
            ["eval", [], "<anonymous>", 4, 17, false, true],
        ]);
        expect(stackFrames[4]).toMatchStackFrame([
            "ReactCompositeComponentMixin.mountComponent",
            [],
            "webpack:///./~/react/lib/ReactCompositeComponent.js?",
            170,
            18,
        ]);
        expect(stackFrames[5]).toMatchStackFrame(["wrapper [as mountComponent]", [], "webpack:///./~/react/lib/ReactPerf.js?", 66, 21]);
        expect(stackFrames[6]).toMatchStackFrame(["Object.ReactReconciler.mountComponent", [], "webpack:///./~/react/lib/ReactReconciler.js?", 39, 35]);
        expect(stackFrames[7]).toMatchStackFrame([
            "ReactCompositeComponentMixin.performInitialMount",
            [],
            "webpack:///./~/react/lib/ReactCompositeComponent.js?",
            289,
            34,
        ]);
        expect(stackFrames[8]).toMatchStackFrame([
            "ReactCompositeComponentMixin.mountComponent",
            [],
            "webpack:///./~/react/lib/ReactCompositeComponent.js?",
            237,
            21,
        ]);
        expect(stackFrames[9]).toMatchStackFrame(["wrapper [as mountComponent]", [], "webpack:///./~/react/lib/ReactPerf.js?", 66, 21]);
    });

    it("should handle spaces in Node.js stacks", () => {
        const stackFrames = parseStacktrace(capturedErrors.NODE_WITH_SPACES as unknown as Error);

        expect(stackFrames).toHaveLength(8);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "/var/app/scratch/my project/index.js", 2, 9]);
        expect(stackFrames[1]).toMatchStackFrame(["Object.<anonymous>", [], "/var/app/scratch/my project/index.js", 2, 9]);
        expect(stackFrames[2]).toMatchStackFrame(["Module._compile", [], "internal/modules/cjs/loader.js", 774, 30]);
        expect(stackFrames[3]).toMatchStackFrame(["Object.Module._extensions..js", [], "internal/modules/cjs/loader.js", 785, 10]);
    });

    it("should handle Node.js stacks with parentheses", () => {
        const stackFrames = parseStacktrace(capturedErrors.NODE_WITH_PARENTHESES as unknown as Error);

        expect(stackFrames).toHaveLength(7);
        expect(stackFrames[0]).toMatchStackFrame(["Object.<anonymous>", [], "/var/app/scratch/my project (top secret)/index.js", 2, 9]);
        expect(stackFrames[1]).toMatchStackFrame(["Module._compile", [], "internal/modules/cjs/loader.js", 774, 30]);
        expect(stackFrames[2]).toMatchStackFrame(["Object.Module._extensions..js", [], "internal/modules/cjs/loader.js", 785, 10]);
        expect(stackFrames[3]).toMatchStackFrame(["Module.load", [], "internal/modules/cjs/loader.js", 641, 32]);
        expect(stackFrames[4]).toMatchStackFrame(["Function.Module._load", [], "internal/modules/cjs/loader.js", 556, 12]);
        expect(stackFrames[5]).toMatchStackFrame(["Function.Module.runMain", [], "internal/modules/cjs/loader.js", 837, 10]);
        expect(stackFrames[6]).toMatchStackFrame(["<unknown>", [], "internal/main/run_main_module.js", 17, 11]);
    });

    it("should parses node error with space in path", () => {
        const stackFrames = parseStacktrace(capturedErrors.NODE_SPACE as unknown as Error);

        expect(stackFrames).toHaveLength(9);
        expect(stackFrames[0]).toMatchStackFrame(["Spect.get", [], "C:\\project files\\spect\\src\\index.js", 161, 26]);
        expect(stackFrames[1]).toMatchStackFrame(["Object.get", [], "C:\\project files\\spect\\src\\index.js", 43, 36]);
        expect(stackFrames[2]).toMatchStackFrame(["(anonymous function).then", [], "C:\\project files\\spect\\src\\index.js", 165, 33]);
        expect(stackFrames[3]).toMatchStackFrame(["process.runNextTicks [as _tickCallback]", [], "internal/process/task_queues.js", 52, 5]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "C:\\project files\\spect\\node_modules\\esm\\esm.js", 1, 34_535]);
        expect(stackFrames[5]).toMatchStackFrame(["<unknown>", [], "C:\\project files\\spect\\node_modules\\esm\\esm.js", 1, 34_176]);
        expect(stackFrames[6]).toMatchStackFrame(["process.<anonymous>", [], "C:\\project files\\spect\\node_modules\\esm\\esm.js", 1, 34_506]);
        expect(stackFrames[7]).toMatchStackFrame(["Function.<anonymous>", [], "C:\\project files\\spect\\node_modules\\esm\\esm.js", 1, 296_856]);
        expect(stackFrames[8]).toMatchStackFrame(["Function.<anonymous>", [], "C:\\project files\\spect\\node_modules\\esm\\esm.js", 1, 296_555]);
    });

    it("should parses node.js async errors available with version 12", () => {
        const stackFrames = parseStacktrace(capturedErrors.NODE_12 as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(["promiseMe", [], "/home/xyz/hack/asyncnode.js", 11, 9]);
        expect(stackFrames[1]).toMatchStackFrame(["async main", [], "/home/xyz/hack/asyncnode.js", 15, 13]);
    });

    it("should parses node.js errors with <anonymous> calls as well", () => {
        const stackFrames = parseStacktrace(capturedErrors.NODE_ANONYM as unknown as Error);

        expect(stackFrames).toHaveLength(9);
        expect(stackFrames[0]).toMatchStackFrame(["Spect.get", [], "C:\\projects\\spect\\src\\index.js", 161, 26]);
        expect(stackFrames[2]).toMatchStackFrame(["(anonymous function).then", [], "C:\\projects\\spect\\src\\index.js", 165, 33]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "C:\\projects\\spect\\node_modules\\esm\\esm.js", 1, 34_535]);
        expect(stackFrames[6]).toMatchStackFrame(["process.<anonymous>", [], "C:\\projects\\spect\\node_modules\\esm\\esm.js", 1, 34_506]);
    });

    it("should parses JavaScriptCore errors", () => {
        const stackFrames = parseStacktrace(capturedErrors.IOS_REACT_NATIVE_1 as unknown as Error);

        expect(stackFrames).toHaveLength(4);
        expect(stackFrames[0]).toMatchStackFrame(["_exampleFunction", [], "/home/test/project/App.js", 125, 13, false, false, false]);
        expect(stackFrames[1]).toMatchStackFrame(["_depRunCallbacks", [], "/home/test/project/node_modules/dep/index.js", 77, 45, false, false, false]);
        expect(stackFrames[2]).toMatchStackFrame([
            "tryCallTwo",
            [],
            "/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js",
            45,
            5,
            false,
            false,
            false,
        ]);
        expect(stackFrames[3]).toMatchStackFrame([
            "doResolve",
            [],
            "/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js",
            200,
            13,
            false,
            false,
            false,
        ]);
    });

    it("should parses an error in react native", () => {
        const stackFrames = parseStacktrace(capturedErrors.IOS_REACT_NATIVE_2 as unknown as Error);

        expect(stackFrames).toHaveLength(11);
        expect(stackFrames[0]).toMatchStackFrame(["s", [], "33.js", 1, 531, false, false, false]);
        expect(stackFrames[1]).toMatchStackFrame(["b", [], "1959.js", 1, 1469, false, false, false]);
        expect(stackFrames[2]).toMatchStackFrame(["onSocketClose", [], "2932.js", 1, 727, false, false, false]);
        expect(stackFrames[3]).toMatchStackFrame(["value", [], "81.js", 1, 1505, false, false, false]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "102.js", 1, 2956, false, false, false]);
        expect(stackFrames[5]).toMatchStackFrame(["value", [], "89.js", 1, 1247, false, false, false]);
        expect(stackFrames[6]).toMatchStackFrame(["value", [], "42.js", 1, 3311, false, false, false]);
        expect(stackFrames[7]).toMatchStackFrame(["<unknown>", [], "42.js", 1, 822, false, false, false]);
        expect(stackFrames[8]).toMatchStackFrame(["value", [], "42.js", 1, 2565, false, false, false]);
        expect(stackFrames[9]).toMatchStackFrame(["value", [], "42.js", 1, 794, false, false, false]);
        expect(stackFrames[10]).toMatchStackFrame(["value", [], "[native code]", undefined, undefined, true]);
    });

    it("should parses very simple JavaScriptCore errors", () => {
        const stackFrames = parseStacktrace({ stack: "global code@stack_traces/test:83:55" } as unknown as Error);

        expect(stackFrames).toHaveLength(1);
        expect(stackFrames[0]).toMatchStackFrame(["global code", [], "stack_traces/test", 83, 55, false, false, false]);
    });

    it("should parses React Native errors on Android", () => {
        const stackFrames = parseStacktrace(capturedErrors.ANDROID_REACT_NATIVE as unknown as Error);

        expect(stackFrames).toHaveLength(8);
        expect(stackFrames[0]).toMatchStackFrame([
            "render",
            [],
            "/home/username/sample-workspace/sampleapp.collect.react/src/components/GpsMonitorScene.js",
            78,
            24,
        ]);
        expect(stackFrames[7]).toMatchStackFrame([
            "this",
            [],
            "/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/native/ReactNativeBaseComponent.js",
            74,
            41,
        ]);
    });

    it("should parses React Native errors on Android Production", () => {
        const stackFrames = parseStacktrace(capturedErrors.ANDROID_REACT_NATIVE_PROD as unknown as Error);

        expect(stackFrames).toHaveLength(37);
        expect(stackFrames[0]).toMatchStackFrame(["value", [], "index.android.bundle", 12, 1917, false, false, false]);
        expect(stackFrames[35]).toMatchStackFrame(["value", [], "index.android.bundle", 29, 927, false, false, false]);
        expect(stackFrames[36]).toMatchStackFrame(["<unknown>", [], "[native code]", undefined, undefined, true]);
    });

    it("should parses anonymous sources", () => {
        const stackFrames = parseStacktrace({
            stack: `x
          at new <anonymous> (http://www.example.com/test.js:2:1
          at <anonymous>:1:2`,
        } as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(["new <anonymous>", [], "http://www.example.com/test.js", 2, 1]);
        expect(stackFrames[1]).toMatchStackFrame(["<unknown>", [], "<anonymous>", 1, 2]);
    });

    it("should parses node.js errors", () => {
        const stackFrames = parseStacktrace({
            stack: `ReferenceError: test is not defined
          at repl:1:2
          at REPLServer.self.eval (repl.js:110:21)
          at Interface.<anonymous> (repl.js:239:12)
          at Interface.EventEmitter.emit (events.js:95:17)
          at emitKey (readline.js:1095:12)`,
        } as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "repl", 1, 2]);
        expect(stackFrames[1]).toMatchStackFrame(["REPLServer.self.eval", [], "repl.js", 110, 21]);
        expect(stackFrames[2]).toMatchStackFrame(["Interface.<anonymous>", [], "repl.js", 239, 12]);
        expect(stackFrames[3]).toMatchStackFrame(["Interface.EventEmitter.emit", [], "events.js", 95, 17]);
        expect(stackFrames[4]).toMatchStackFrame(["emitKey", [], "readline.js", 1095, 12]);

        const stackFrames2 = parseStacktrace({
            stack: `ReferenceError: breakDown is not defined
          at null._onTimeout (repl:1:25)
          at Timer.listOnTimeout [as ontimeout] (timers.js:110:15)`,
        } as unknown as Error);

        expect(stackFrames2).toHaveLength(2);
        expect(stackFrames2[0]).toMatchStackFrame(["null._onTimeout", [], "repl", 1, 25]);
        expect(stackFrames2[1]).toMatchStackFrame(["Timer.listOnTimeout [as ontimeout]", [], "timers.js", 110, 15]);
    });

    it("should parse TypeError stack", () => {
        const stackFrames = parseStacktrace(new TypeError("foo"));

        expect(stackFrames).toHaveLength(10);
    });

    it("should parse Custom Error stack", () => {
        class xxx1Error extends TypeError {}

        const stackFrames = parseStacktrace(new xxx1Error("foo"));

        expect(stackFrames).toHaveLength(10);
    });

    it("should parse Travis Error", () => {
        const stackFrames = parseStacktrace({
            stack: `Error: foo
     at extensions.(anonymous function) (a.js:13:11)`,
        } as unknown as Error);

        expect(stackFrames).toHaveLength(1);
        expect(stackFrames[0]).toMatchStackFrame(["extensions.(anonymous function)", [], "a.js", 13, 11]);
    });

    it("should parse a eval Error", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,no-eval
        const stackFrames = parseStacktrace(eval('new Error("foo:eval")'));

        expect(stackFrames).toHaveLength(10);
        expect(stackFrames[0]).toMatchStackFrame(["eval", [], `${__dirname}/parse-stacktrace.test.ts`, 605, 45, false, true, undefined, ["eval", [], "<anonymous>", 1, 1, false, true]]);
    });

    it("should parse regular expression in error stacktrace", () => {
        process.env.DEBUG = "true";
        const stackFrames = parseStacktrace({
            stack: `    error("Warning: Received \`%s\` for a non-boolean attribute \`%s\`.

If you want to write it to the DOM, pass a string instead: %s=\"%s\" or %s={value.toString()}.

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
                                                                                                                                                                                                        in App (at src/index.tsx:30)") at console.error (http://localhost:3340/__cypress/runner/cypress_runner.js:140661:26)
`,
        } as unknown as Error);

        console.log(stackFrames);
    });
});
