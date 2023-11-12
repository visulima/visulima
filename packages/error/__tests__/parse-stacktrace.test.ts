import { describe, expect, it } from "vitest";

import capturedErrors from "../__fixtures__/captured-errors";
import { parseStacktrace } from "../src";

expect.extend({
    toMatchStackFrame(received, [function_, arguments_ = [], file, lineNumber, columnNumber]) {
        const pass = received.methodName === function_ && received.file === file && received.line === lineNumber && received.column === columnNumber;

        const sortedExpectedArguments = [...arguments_].sort((a, b) => a - b);
        const sortedReceivedArguments = [...received.args].sort((a, b) => a - b);

        if (sortedExpectedArguments.length !== sortedReceivedArguments.length) {
            return {
                message: () => `received args and expected args do not have the same length`,
                pass: false,
            };
        }

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const [index, element] of sortedExpectedArguments.entries()) {
            // eslint-disable-next-line security/detect-object-injection
            if (element !== sortedReceivedArguments[index]) {
                return {
                    // eslint-disable-next-line security/detect-object-injection
                    message: () => `Element ${JSON.stringify(element)} at index ${index} does not match ${JSON.stringify(sortedReceivedArguments[index])}`,
                    pass: false,
                };
            }
        }

        if (pass) {
            return {
                message: () => `expected ${received} not to match stack frame`,
                pass: true,
            };
        }

        return {
            message: () =>
                `expected ${JSON.stringify(received)} to match stack frame ${JSON.stringify({
                    args: arguments_,
                    column: columnNumber,
                    file,
                    line: lineNumber,
                    methodName: function_,
                })}`,
            pass: false,
        };
    },
});

describe("parse-stacktrace", () => {
    it("should parse Safari 6 Error.stack", () => {
        const stackFrames = parseStacktrace(capturedErrors.SAFARI_6 as unknown as Error);

        expect(stackFrames).toHaveLength(4);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 48, undefined]);
        expect(stackFrames[1]).toMatchStackFrame(["dumpException3", [], "http://path/to/file.js", 52, undefined]);
        expect(stackFrames[2]).toMatchStackFrame(["onclick", [], "http://path/to/file.js", 82, undefined]);
        expect(stackFrames[3]).toMatchStackFrame(["<unknown>", [], "[native code]", undefined, undefined]);
    });

    it("should parse Safari 7 Error.stack", () => {
        const stackFrames = parseStacktrace(capturedErrors.SAFARI_7 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 48, 22]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 52, 15]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 108, 107]);
    });

    it("should parse Safari 8 Error.stack", () => {
        const stackFrames = parseStacktrace(capturedErrors.SAFARI_8 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 47, 22]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 52, 15]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 108, 23]);
    });

    it("should parses Safari 8 eval error", () => {
        process.env.DEBUG = true;
        // TODO: Take into account the line and column properties on the error object and use them for the first stack trace.
        const stackFrames = parseStacktrace(capturedErrors.SAFARI_8_EVAL);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["eval", [], "[native code]", undefined, undefined]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 58, 21]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 109, 91]);
    });

    it("should parse nested eval() from Safari 9", () => {
        const stackFrames = parseStacktrace(capturedErrors.SAFARI_9_NESTED_EVAL as unknown as Error);

        expect(stackFrames).toHaveLength(6);
        expect(stackFrames[0]).toMatchStackFrame(["baz", [], undefined, undefined, undefined]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], undefined, undefined, undefined]);
        expect(stackFrames[2]).toMatchStackFrame(["eval code", [], undefined, undefined, undefined]);
        expect(stackFrames[3]).toMatchStackFrame(["eval", [], "[native code]", undefined, undefined]);
        expect(stackFrames[4]).toMatchStackFrame(["speak", [], "http://localhost:8080/file.js", 26, 21]);
        expect(stackFrames[5]).toMatchStackFrame(["global code", [], "http://localhost:8080/file.js", 33, 18]);
    });

    it("should parse Firefox 31 Error.stack", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_31 as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 41, 13]);
        expect(stackFrames[1]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 1, 1]);
    });

    it("should parse nested eval() from Firefox 43", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_43_NESTED_EVAL as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(["baz", [], "http://localhost:8080/file.js", 26, undefined]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://localhost:8080/file.js", 26, undefined]);
        expect(stackFrames[2]).toMatchStackFrame(["<unknown>", [], "http://localhost:8080/file.js", 26, undefined]);
        expect(stackFrames[3]).toMatchStackFrame(["speak", [], "http://localhost:8080/file.js", 26, 17]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "http://localhost:8080/file.js", 33, 9]);
    });

    it("should parse function names containing @ in Firefox 43 Error.stack", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_43_FUNCTION_NAME_WITH_AT_SIGN as unknown as Error);

        expect(stackFrames).toHaveLength(2);
        expect(stackFrames[0]).toMatchStackFrame(['obj["@fn"]', [], "Scratchpad/1", 10, 29]);
        expect(stackFrames[1]).toMatchStackFrame(["<unknown>", [], "Scratchpad/1", 11, 1]);
    });

    it("should parse stack traces with @ in the URL", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_60_URL_WITH_AT_SIGN as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(["who", [], "http://localhost:5000/misc/@stuff/foo.js", 3, 9]);
        expect(stackFrames[1]).toMatchStackFrame(["what", [], "http://localhost:5000/misc/@stuff/foo.js", 6, 3]);
    });

    it("should parse stack traces with @ in the URL and the method", () => {
        const stackFrames = parseStacktrace(capturedErrors.FIREFOX_60_URL_AND_FUNCTION_NAME_WITH_AT_SIGN as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(['obj["@who"]', [], "http://localhost:5000/misc/@stuff/foo.js", 4, 9]);
        expect(stackFrames[1]).toMatchStackFrame(["what", [], "http://localhost:5000/misc/@stuff/foo.js", 8, 3]);
    });

    it("should parse V8 Error.stack", () => {
        const stackFrames = parseStacktrace(capturedErrors.CHROME_15 as unknown as Error);

        expect(stackFrames).toHaveLength(4);
        expect(stackFrames[0]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 13, 17]);
        expect(stackFrames[1]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 16, 5]);
        expect(stackFrames[2]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 20, 5]);
        expect(stackFrames[3]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 24, 4]);
    });

    it("should parse V8 entries with no location", () => {
        const stackFrames = parseStacktrace({ stack: "Error\n at Array.forEach (native)" } as unknown as Error);

        expect(stackFrames).toHaveLength(1);
        expect(stackFrames[0]).toMatchStackFrame(["Array.forEach", ["native"], undefined, undefined, undefined]);
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
        expect(stackFrames[0]).toMatchStackFrame(["baz", [], "http://localhost:8080/file.js", 21, 17]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://localhost:8080/file.js", 21, 17]);
        expect(stackFrames[2]).toMatchStackFrame(["eval", [], "http://localhost:8080/file.js", 21, 17]);
        expect(stackFrames[3]).toMatchStackFrame(["Object.speak", [], "http://localhost:8080/file.js", 21, 17]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "http://localhost:8080/file.js", 31, 13]);
    });

    it("should parse IE 10 Error stacks", () => {
        const stackFrames = parseStacktrace(capturedErrors.IE_10 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["Anonymous function", [], "http://path/to/file.js", 48, 13]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 46, 9]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 82, 1]);
    });

    it("should parse IE 11 Error stacks", () => {
        const stackFrames = parseStacktrace(capturedErrors.IE_11 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["Anonymous function", [], "http://path/to/file.js", 47, 21]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 45, 13]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 108, 1]);
    });

    it("should parse nested eval() from Edge", () => {
        const stackFrames = parseStacktrace(capturedErrors.EDGE_20_NESTED_EVAL as unknown as Error);

        expect(stackFrames).toHaveLength(5);
        expect(stackFrames[0]).toMatchStackFrame(["baz", [], "eval code", 1, 18]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "eval code", 2, 90]);
        expect(stackFrames[2]).toMatchStackFrame(["eval code", [], "eval code", 4, 18]);
        expect(stackFrames[3]).toMatchStackFrame(["speak", [], "http://localhost:8080/file.js", 25, 17]);
        expect(stackFrames[4]).toMatchStackFrame(["Global code", [], "http://localhost:8080/file.js", 32, 9]);
    });

    it("should parse Opera 25 Error stacks", () => {
        const stackFrames = parseStacktrace(capturedErrors.OPERA_25 as unknown as Error);

        expect(stackFrames).toHaveLength(3);
        expect(stackFrames[0]).toMatchStackFrame(["<unknown>", [], "http://path/to/file.js", 47, 22]);
        expect(stackFrames[1]).toMatchStackFrame(["foo", [], "http://path/to/file.js", 52, 15]);
        expect(stackFrames[2]).toMatchStackFrame(["bar", [], "http://path/to/file.js", 108, 168]);
    });

    it("should handle newlines in Error stack messages", () => {
        process.env.DEBUG = true;
        const stackFrames = parseStacktrace({
            stack:
                // eslint-disable-next-line no-useless-concat
                "Error: Problem at this\nlocation. Error code:1234\n" + "    at http://path/to/file.js:47:22\n" + "    at foo (http://path/to/file.js:52:15)",
        } as unknown as Error);
        console.log(stackFrames);
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
            "/usr/local/xxxxxxx/cli-reproductions/showwcase-v14-rc0/node_modules/tapable/lib/HookCodeFactory.js",
            33,
            10,
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
        expect(stackFrames[1]).toMatchStackFrame(["eval", [], "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?", 90, 24]);
        expect(stackFrames[2]).toMatchStackFrame(["instantiate", [], "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?", 98, 9]);
        expect(stackFrames[3]).toMatchStackFrame([
            "Layout",
            [],
            "webpack:///../react-hot-loader/~/react-proxy/modules/createClassProxy.js?",
            undefined,
            undefined,
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

    it("should parses JavaScriptCore errors", () => {
        const stackFrames = parseStacktrace(capturedErrors.IOS_REACT_NATIVE_1 as unknown as Error);

        expect(stackFrames).toHaveLength(4);
        expect(stackFrames[0]).toMatchStackFrame(["_exampleFunction", [], "/home/test/project/App.js", 125, 13]);
        expect(stackFrames[1]).toMatchStackFrame(["_depRunCallbacks", [], "/home/test/project/node_modules/dep/index.js", 77, 45]);
        expect(stackFrames[2]).toMatchStackFrame(["tryCallTwo", [], "/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js", 45, 5]);
        expect(stackFrames[3]).toMatchStackFrame(["doResolve", [], "/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js", 200, 13]);
    });

    it("should parses an error in react native", () => {
        const stackFrames = parseStacktrace(capturedErrors.IOS_REACT_NATIVE_2 as unknown as Error);

        expect(stackFrames).toHaveLength(11);
        expect(stackFrames[0]).toMatchStackFrame(["s", [], "33.js", 1, 531]);
        expect(stackFrames[1]).toMatchStackFrame(["b", [], "1959.js", 1, 1469]);
        expect(stackFrames[2]).toMatchStackFrame(["onSocketClose", [], "2932.js", 1, 727]);
        expect(stackFrames[3]).toMatchStackFrame(["value", [], "81.js", 1, 1505]);
        expect(stackFrames[4]).toMatchStackFrame(["<unknown>", [], "102.js", 1, 2956]);
        expect(stackFrames[5]).toMatchStackFrame(["value", [], "89.js", 1, 1247]);
        expect(stackFrames[6]).toMatchStackFrame(["value", [], "42.js", 1, 3311]);
        expect(stackFrames[7]).toMatchStackFrame(["<unknown>", [], "42.js", 1, 822]);
        expect(stackFrames[8]).toMatchStackFrame(["value", [], "42.js", 1, 2565]);
        expect(stackFrames[9]).toMatchStackFrame(["value", [], "42.js", 1, 794]);
        expect(stackFrames[10]).toMatchStackFrame(["value", [], "[native code]", undefined, undefined]);
    });

    it("should parses very simple JavaScriptCore errors", () => {
        const stackFrames = parseStacktrace({ stack: "global code@stack_traces/test:83:55" } as unknown as Error);

        expect(stackFrames).toHaveLength(1);
        expect(stackFrames[0]).toMatchStackFrame(["global code", [], "stack_traces/test", 83, 55]);
    });
});
