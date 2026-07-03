export default {
    OPERA_25: {
        message: "Cannot read property 'undef' of null",
        name: "TypeError",
        stack:
            "TypeError: Cannot read property 'undef' of null\n" +
            "    at http://path/to/file.js:47:22\n" +
            "    at foo (http://path/to/file.js:52:15)\n" +
            "    at bar (http://path/to/file.js:108:168)",
    },

    CHROME_BRACES_URL: {
        message: "bad",
        name: "Error",
        stack: `Error: bad
          at something (http://localhost:5000/(some)/(thing)/index.html:20:16)
          at more (http://localhost:5000/(some)/(thing)/index.html:25:7)`,
    },

    CHROME_15: {
        arguments: ["undef"],
        message: "Object #<Object> has no method 'undef'",
        stack:
            "TypeError: Object #<Object> has no method 'undef'\n" +
            "    at bar (http://path/to/file.js:13:17)\n" +
            "    at bar (http://path/to/file.js:16:5)\n" +
            "    at foo (http://path/to/file.js:20:5)\n" +
            "    at http://path/to/file.js:24:4",
    },

    CHROME_36: {
        message: "Default error",
        name: "Error",
        stack:
            "Error: Default error\n" +
            "    at dumpExceptionError (http://localhost:8080/file.js:41:27)\n" +
            "    at HTMLButtonElement.onclick (http://localhost:8080/file.js:107:146)\n" +
            "    at I.e.fn.(anonymous function) [as index] (http://localhost:8080/file.js:10:3651)",
    },

    CHROME73_NATIVE_CODE_EXCEPTION: {
        message: "test",
        name: "Error",
        stack: `Error: test
            at fooIterator (http://localhost:5000/test:20:17)
            at Array.map (<anonymous>)
            at foo (http://localhost:5000/test:19:19)
            at http://localhost:5000/test:24:7`,
    },

    CHROME_46: {
        message: "Default error",
        name: "Error",
        stack:
            "Error: Default error\n" +
            "    at new CustomError (http://localhost:8080/file.js:41:27)\n" +
            "    at HTMLButtonElement.onclick (http://localhost:8080/file.js:107:146)",
    },

    CHROME_48_NESTED_EVAL: {
        message: "message string",
        name: "Error",
        stack:
            "Error: message string\n" +
            "at baz (eval at foo (eval at speak (http://localhost:8080/file.js:21:17)), <anonymous>:1:30)\n" +
            "at foo (eval at speak (http://localhost:8080/file.js:21:17), <anonymous>:2:96)\n" +
            "at eval (eval at speak (http://localhost:8080/file.js:21:17), <anonymous>:4:18)\n" +
            "at Object.speak (http://localhost:8080/file.js:21:17)\n" +
            "at http://localhost:8080/file.js:31:13\n",
    },

    FIREFOX_60_URL_WITH_AT_SIGN: {
        message: "culprit",
        name: "Error",
        stack:
            "who@http://localhost:5000/misc/@stuff/foo.js:3:9\n" +
            "what@http://localhost:5000/misc/@stuff/foo.js:6:3\n" +
            "where@http://localhost:5000/misc/@stuff/foo.js:9:3\n" +
            "why@https://localhost:5000/misc/@stuff/foo.js:12:3\n" +
            "@http://localhost:5000/misc/@stuff/foo.js:15:1\n",
        fileName: "http://localhost:5000/misc/@stuff/foo.js",
        lineNumber: 3,
        columnNumber: 9,
    },

    FIREFOX_60_URL_AND_FUNCTION_NAME_WITH_AT_SIGN: {
        message: "culprit",
        name: "Error",
        stack:
            'obj["@who"]@http://localhost:5000/misc/@stuff/foo.js:4:9\n' +
            "what@http://localhost:5000/misc/@stuff/foo.js:8:3\n" +
            "where@http://localhost:5000/misc/@stuff/foo.js:11:3\n" +
            "why@http://localhost:5000/misc/@stuff/foo.js:14:3\n" +
            "@http://localhost:5000/misc/@stuff/foo.js:17:1\n",
        fileName: "http://localhost:5000/misc/@stuff/foo.js",
        lineNumber: 4,
        columnNumber: 9,
    },

    FIREFOX_66_NATIVE_CODE_EXCEPTION: {
        message: "test",
        name: "Error",
        stack: `fooIterator@http://localhost:5000/test:20:17
            foo@http://localhost:5000/test:19:19
            @http://localhost:5000/test:24:7`,
    },

    FIREFOX_66_EVAL_EXCEPTION: {
        message: "aha",
        name: "Error",
        stack: `aha@http://localhost:5000/:19:13
            callAnotherThing@http://localhost:5000/:20:15
            callback@http://localhost:5000/:25:7
            test/<@http://localhost:5000/:34:7
            test@http://localhost:5000/:33:23
            @http://localhost:5000/ line 39 > eval:1:1
            aha@http://localhost:5000/:39:5
            testMethod@http://localhost:5000/:44:7
            @http://localhost:5000/:50:19`,
    },

    IE_11: {
        message: "Unable to get property 'undef' of undefined or null reference",
        name: "TypeError",
        stack:
            "TypeError: Unable to get property 'undef' of undefined or null reference\n" +
            "   at Anonymous function (http://path/to/file.js:47:21)\n" +
            "   at foo (http://path/to/file.js:45:13)\n" +
            "   at bar (http://path/to/file.js:108:1)",
        description: "Unable to get property 'undef' of undefined or null reference",
        number: -2146823281,
    },

    EDGE_20_NESTED_EVAL: {
        description: "message string",
        message: "message string",
        name: "Error",
        stack:
            "Error: message string\n" +
            "  at baz (eval code:1:18)\n" +
            "  at foo (eval code:2:90)\n" +
            "  at eval code (eval code:4:18)\n" +
            "  at speak (http://localhost:8080/file.js:25:17)\n" +
            "  at Global code (http://localhost:8080/file.js:32:9)",
    },

    EDGE_44_NATIVE_CODE_EXCEPTION: {
        message: "test",
        name: "Error",
        stack: `Error: test
            at fooIterator (http://localhost:5000/test:20:11)
            at Array.prototype.map (native code)
            at foo (http://localhost:5000/test:19:9)
            at Global code (http://localhost:5000/test:24:7)`,
    },

    EDGE_44_EVAL_EXCEPTION: {
        message: "aha",
        name: "Error",
        stack: `Error: bad
            at aha (http://localhost:5000/:19:7)
            at callAnotherThing (http://localhost:5000/:18:6)
            at callback (http://localhost:5000/:25:7)
            at Anonymous function (http://localhost:5000/:34:7)
            at Array.prototype.map (native code)
            at test (http://localhost:5000/:33:5)
            at eval code (eval code:1:1)
            at aha (http://localhost:5000/:39:5)
            at Foo.prototype.testMethod (http://localhost:5000/:44:7)
            at Anonymous function (http://localhost:5000/:50:8)`,
    },

    NODE_WITH_SPACES: {
        name: "Error",
        message: "",
        stack:
            "Error\n     at /var/app/scratch/my " +
            "project/index.js:2:9\n    at Object.<anonymous> " +
            "(/var/app/scratch/my " +
            "project/index.js:2:9)\n    at Module._compile " +
            "(internal/modules/cjs/loader.js:774:30)\n    at " +
            "Object.Module._extensions..js (internal/modules/cjs/loader.js:785:10)\n   " +
            " at Module.load (internal/modules/cjs/loader.js:641:32)\n    at " +
            "Function.Module._load (internal/modules/cjs/loader.js:556:12)\n    at " +
            "Function.Module.runMain (internal/modules/cjs/loader.js:837:10)\n    at " +
            "internal/main/run_main_module.js:17:11",
    },

    NODE_WITH_PARENTHESES: {
        name: "Error",
        message: "",
        stack:
            "Error\n    at Object.<anonymous> " +
            "(/var/app/scratch/my " +
            "project (top secret)/index.js:2:9)\n    at Module._compile " +
            "(internal/modules/cjs/loader.js:774:30)\n    at " +
            "Object.Module._extensions..js (internal/modules/cjs/loader.js:785:10)\n   " +
            " at Module.load (internal/modules/cjs/loader.js:641:32)\n    at " +
            "Function.Module._load (internal/modules/cjs/loader.js:556:12)\n    at " +
            "Function.Module.runMain (internal/modules/cjs/loader.js:837:10)\n    at " +
            "internal/main/run_main_module.js:17:11",
    },

    NODE_12: {
        message: "Just an Exception",
        name: "Error",
        stack: "Error: Just an Exception\n" + "    at promiseMe (/home/xyz/hack/asyncnode.js:11:9)\n" + "    at async main (/home/xyz/hack/asyncnode.js:15:13)",
    },

    NODE_ANONYM: {
        message: "",
        name: "Error",
        stack: `Error
    at Spect.get (C:\\projects\\spect\\src\\index.js:161:26)
    at Object.get (C:\\projects\\spect\\src\\index.js:43:36)
    at <anonymous>
    at (anonymous function).then (C:\\projects\\spect\\src\\index.js:165:33)
    at process.runNextTicks [as _tickCallback] (internal/process/task_queues.js:52:5)
    at C:\\projects\\spect\\node_modules\\esm\\esm.js:1:34535
    at C:\\projects\\spect\\node_modules\\esm\\esm.js:1:34176
    at process.<anonymous> (C:\\projects\\spect\\node_modules\\esm\\esm.js:1:34506)
    at Function.<anonymous> (C:\\projects\\spect\\node_modules\\esm\\esm.js:1:296856)
    at Function.<anonymous> (C:\\projects\\spect\\node_modules\\esm\\esm.js:1:296555)`,
    },

    NODE_SPACE: {
        message: "",
        name: "Error",
        stack: `Error
    at Spect.get (C:\\project files\\spect\\src\\index.js:161:26)
    at Object.get (C:\\project files\\spect\\src\\index.js:43:36)
    at <anonymous>
    at (anonymous function).then (C:\\project files\\spect\\src\\index.js:165:33)
    at process.runNextTicks [as _tickCallback] (internal/process/task_queues.js:52:5)
    at C:\\project files\\spect\\node_modules\\esm\\esm.js:1:34535
    at C:\\project files\\spect\\node_modules\\esm\\esm.js:1:34176
    at process.<anonymous> (C:\\project files\\spect\\node_modules\\esm\\esm.js:1:34506)
    at Function.<anonymous> (C:\\project files\\spect\\node_modules\\esm\\esm.js:1:296856)
    at Function.<anonymous> (C:\\project files\\spect\\node_modules\\esm\\esm.js:1:296555)`,
    },

    CHROME_58_EVAL: {
        message: "message string",
        name: "Error",
        stack:
            "Error: message string\n" +
            "at willThrow (eval at h (index.js:11), <anonymous>:3:3)\n" +
            "at eval (eval at h (index.js:11), <anonymous>:6:1)\n" +
            "at h (index.js:11)\n" +
            "at g (index.js:6)\n" +
            "at f (index.js:2)\n" +
            "at index.js:23\n",
    },

    CHROME_73_EVAL_EXCEPTION: {
        message: "bad",
        name: "Error",
        stack: `Error: bad
            at Object.aha (http://localhost:5000/:19:13)
            at callAnotherThing (http://localhost:5000/:20:16)
            at Object.callback (http://localhost:5000/:25:7)
            at http://localhost:5000/:34:17
            at Array.map (<anonymous>)
            at test (http://localhost:5000/:33:23)
            at eval (eval at aha (http://localhost:5000/:37:5), <anonymous>:1:1)
            at aha (http://localhost:5000/:39:5)
            at Foo.testMethod (http://localhost:5000/:44:7)
            at http://localhost:5000/:50:19`,
    },

    CHROME_76: {
        message: "BEEP BEEP",
        name: "Error",
        stack: "Error: BEEP BEEP\n" + "    at bar (<anonymous>:8:9)\n" + "    at async foo (<anonymous>:2:3)",
    },

    // can be generated when Webpack is built with source maps
    CHROME_XX_WEBPACK: {
        message: "Cannot read property 'error' of undefined",
        name: "TypeError",
        stack:
            "TypeError: Cannot read property 'error' of undefined\n" +
            // { devtool: eval }:
            "   at TESTTESTTEST.eval(webpack:///./src/components/test/test.jsx?:295:108)\n" +
            "   at TESTTESTTEST.render(webpack:///./src/components/test/test.jsx?:272:32)\n" +
            "   at TESTTESTTEST.tryRender(webpack:///./~/react-transform-catch-errors/lib/index.js?:34:31)\n" +
            "   at TESTTESTTEST.proxiedMethod(webpack:///./~/react-proxy/modules/createPrototypeProxy.js?:44:30)\n" +
            // { devtool: source-map }:
            "   at Module../pages/index.js (C:\\root\\server\\development\\pages\\index.js:182:7)",
    },

    CHROME_ELECTRON_RENDERER: {
        message: "Cannot read property 'error' of undefined",
        name: "TypeError",
        stack: `TypeError: Cannot read property 'error' of undefined
            at TESTTESTTEST.someMethod (C:\\Users\\user\\path\\to\\file.js:295:108)`,
    },

    FIREFOX_3: {
        fileName: "http://127.0.0.1:8000/js/stacktrace.js",
        lineNumber: 44,
        message: "this.undef is not a function",
        name: "TypeError",
        stack:
            "()@http://127.0.0.1:8000/js/stacktrace.js:44\n" +
            "(null)@http://127.0.0.1:8000/js/stacktrace.js:31\n" +
            "printStackTrace()@http://127.0.0.1:8000/js/stacktrace.js:18\n" +
            "bar(1)@http://127.0.0.1:8000/js/file.js:13\n" +
            "bar(2)@http://127.0.0.1:8000/js/file.js:16\n" +
            "foo()@http://127.0.0.1:8000/js/file.js:20\n" +
            "@http://127.0.0.1:8000/js/file.js:24\n" +
            "",
    },

    FIREFOX_7: {
        fileName: "file:///G:/js/stacktrace.js",
        lineNumber: 44,
        stack:
            "()@file:///G:/js/stacktrace.js:44\n" +
            "(null)@file:///G:/js/stacktrace.js:31\n" +
            "printStackTrace()@file:///G:/js/stacktrace.js:18\n" +
            "bar(1)@file:///G:/js/file.js:13\n" +
            "bar(2)@file:///G:/js/file.js:16\n" +
            "foo()@file:///G:/js/file.js:20\n" +
            "@file:///G:/js/file.js:24\n" +
            "",
    },

    FIREFOX_14: {
        message: "x is null",
        stack: "@http://path/to/file.js:48\n" + "dumpException3@http://path/to/file.js:52\n" + "onclick@http://path/to/file.js:1\n" + "",
        fileName: "http://path/to/file.js",
        lineNumber: 48,
    },

    FIREFOX_31: {
        message: "Default error",
        name: "Error",
        stack: "foo@http://path/to/file.js:41:13\n" + "bar@http://path/to/file.js:1:1\n" + ".plugin/e.fn[c]/<@http://path/to/file.js:1:1\n" + "",
        fileName: "http://path/to/file.js",
        lineNumber: 41,
        columnNumber: 12,
    },

    FIREFOX_43_NESTED_EVAL: {
        columnNumber: 30,
        fileName: "http://localhost:8080/file.js line 25 > eval line 2 > eval",
        lineNumber: 1,
        message: "message string",
        stack:
            "baz@http://localhost:8080/file.js line 26 > eval line 2 > eval:1:30\n" +
            "foo@http://localhost:8080/file.js line 26 > eval:2:96\n" +
            "@http://localhost:8080/file.js line 26 > eval:4:18\n" +
            "speak@http://localhost:8080/file.js:26:17\n" +
            "@http://localhost:8080/file.js:33:9",
    },

    FIREFOX_43_FUNCTION_NAME_WITH_AT_SIGN: {
        message: "Dummy error",
        name: "Error",
        stack: 'obj["@fn"]@Scratchpad/1:10:29\n' + "@Scratchpad/1:11:1\n" + "",
        fileName: "Scratchpad/1",
        lineNumber: 10,
        columnNumber: 29,
    },

    // Internal errors sometimes thrown by Firefox
    // More here: https://developer.mozilla.org/en-US/docs/Mozilla/Errors
    //
    // Note that such errors are instanceof "Exception", not "Error"
    FIREFOX_44_NS_EXCEPTION: {
        message: "",
        name: "NS_ERROR_FAILURE",
        stack:
            "[2]</Bar.prototype._baz/</<@http://path/to/file.js:703:28\n" +
            "App.prototype.foo@file:///path/to/file.js:15:2\n" +
            "bar@file:///path/to/file.js:20:3\n" +
            "@file:///path/to/index.html:23:1\n" + // inside <script> tag
            "",
        fileName: "http://path/to/file.js",
        columnNumber: 28,
        lineNumber: 703,
        result: 2147500037,
    },

    FIREFOX_50_RESOURCE_URL: {
        stack:
            "render@resource://path/data/content/bundle.js:5529:16\n" +
            "dispatchEvent@resource://path/data/content/vendor.bundle.js:18:23028\n" +
            "wrapped@resource://path/data/content/bundle.js:7270:25",
        fileName: "resource://path/data/content/bundle.js",
        lineNumber: 5529,
        columnNumber: 16,
        message: "this.props.raw[this.state.dataSource].rows is undefined",
        name: "TypeError",
    },

    IE_10: {
        message: "Unable to get property 'undef' of undefined or null reference",
        stack:
            "TypeError: Unable to get property 'undef' of undefined or null reference\n" +
            "   at Anonymous function (http://path/to/file.js:48:13)\n" +
            "   at foo (http://path/to/file.js:46:9)\n" +
            "   at bar (http://path/to/file.js:82:1)",
        description: "Unable to get property 'undef' of undefined or null reference",
        number: -2146823281,
    },

    IE_11_EVAL: {
        message: "'getExceptionProps' is undefined",
        name: "ReferenceError",
        stack:
            "ReferenceError: 'getExceptionProps' is undefined\n" +
            "   at eval code (eval code:1:1)\n" +
            "   at foo (http://path/to/file.js:58:17)\n" +
            "   at bar (http://path/to/file.js:109:1)",
        description: "'getExceptionProps' is undefined",
        number: -2146823279,
    },

    CHROMIUM_EMBEDDED_FRAMEWORK_CUSTOM_SCHEME: {
        message: "message string",
        name: "Error",
        stack: `Error: message string
            at examplescheme://examplehost/cd351f7250857e22ceaa.worker.js:70179:15`,
    },

    CHROME_48_BLOB: {
        message: "Error: test",
        name: "Error",
        stack:
            "Error: test\n" +
            "    at Error (native)\n" +
            "    at s (blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379:31:29146)\n" +
            "    at Object.d [as add] (blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379:31:30039)\n" +
            "    at blob:http%3A//localhost%3A8080/d4eefe0f-361a-4682-b217-76587d9f712a:15:10978\n" +
            "    at blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379:1:6911\n" +
            "    at n.fire (blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379:7:3019)\n" +
            "    at n.handle (blob:http%3A//localhost%3A8080/abfc40e9-4742-44ed-9dcd-af8f99a29379:7:2863)",
    },

    CHROME_48_EVAL: {
        message: "message string",
        name: "Error",
        stack:
            "Error: message string\n" +
            "at baz (eval at foo (eval at speak (http://localhost:8080/file.js:21:17)), <anonymous>:1:30)\n" +
            "at foo (eval at speak (http://localhost:8080/file.js:21:17), <anonymous>:2:96)\n" +
            "at eval (eval at speak (http://localhost:8080/file.js:21:17), <anonymous>:4:18)\n" +
            "at Object.speak (http://localhost:8080/file.js:21:17)\n" +
            "at http://localhost:8080/file.js:31:13\n",
    },

    CHROME_109_ASYNC_URL: {
        message: "bad",
        name: "Error",
        stack: `Error: bad
          at callAnotherThing (http://localhost:5000/:20:16)
          at Object.callback (async http://localhost:5000/:25:7)
          at test (http://localhost:5000/:33:23)`,
    },

    PHANTOMJS_1_19: {
        stack: "Error: foo\n" + "    at file:///path/to/file.js:878\n" + "    at foo (http://path/to/file.js:4283)\n" + "    at http://path/to/file.js:4287",
    },

    ANDROID_REACT_NATIVE: {
        message: "Error: test",
        name: "Error",
        stack:
            "Error: test\n" +
            "at render(/home/username/sample-workspace/sampleapp.collect.react/src/components/GpsMonitorScene.js:78:24)\n" +
            "at _renderValidatedComponentWithoutOwnerOrContext(/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/shared/stack/reconciler/ReactCompositeComponent.js:1050:29)\n" +
            "at _renderValidatedComponent(/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/shared/stack/reconciler/ReactCompositeComponent.js:1075:15)\n" +
            "at renderedElement(/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/shared/stack/reconciler/ReactCompositeComponent.js:484:29)\n" +
            "at _currentElement(/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/shared/stack/reconciler/ReactCompositeComponent.js:346:40)\n" +
            "at child(/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/shared/stack/reconciler/ReactReconciler.js:68:25)\n" +
            "at children(/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/shared/stack/reconciler/ReactMultiChild.js:264:10)\n" +
            "at this(/home/username/sample-workspace/sampleapp.collect.react/node_modules/react-native/Libraries/Renderer/src/renderers/native/ReactNativeBaseComponent.js:74:41)\n",
    },

    ANDROID_REACT_NATIVE_HERMES: {
        message: "Error: lets throw!",
        name: "Error",
        stack:
            "at onPress (address at index.android.bundle:1:452701)\n" +
            "at anonymous (address at index.android.bundle:1:224280)\n" +
            "at _performSideEffectsForTransition (address at index.android.bundle:1:230843)\n" +
            "at _receiveSignal (native)\n" +
            "at touchableHandleResponderRelease (native)\n" +
            "at onResponderRelease (native)\n" +
            "at apply (native)\n" +
            "at b (address at index.android.bundle:1:74037)\n" +
            "at apply (native)\n" +
            "at k (address at index.android.bundle:1:74094)\n" +
            "at apply (native)\n" +
            "at C (address at index.android.bundle:1:74126)\n" +
            "at N (address at index.android.bundle:1:74267)\n" +
            "at A (address at index.android.bundle:1:74709)\n" +
            "at forEach (native)\n" +
            "at z (address at index.android.bundle:1:74642)\n" +
            "at anonymous (address at index.android.bundle:1:77747)\n" +
            "at _e (address at index.android.bundle:1:127755)\n" +
            "at Ne (address at index.android.bundle:1:77238)\n" +
            "at Ue (address at index.android.bundle:1:77571)\n" +
            "at receiveTouches (address at index.android.bundle:1:122512)\n" +
            "at apply (native)\n" +
            "at value (address at index.android.bundle:1:33176)\n" +
            "at anonymous (address at index.android.bundle:1:31603)\n" +
            "at value (address at index.android.bundle:1:32776)\n" +
            "at value (address at index.android.bundle:1:31561)",
    },

    ANDROID_REACT_NATIVE_PROD: {
        message: "Error: test",
        name: "Error",
        stack:
            "value@index.android.bundle:12:1917\n" +
            "onPress@index.android.bundle:12:2336\n" +
            "touchableHandlePress@index.android.bundle:258:1497\n" +
            "[native code]\n" +
            "_performSideEffectsForTransition@index.android.bundle:252:8508\n" +
            "[native code]\n" +
            "_receiveSignal@index.android.bundle:252:7291\n" +
            "[native code]\n" +
            "touchableHandleResponderRelease@index.android.bundle:252:4735\n" +
            "[native code]\n" +
            "u@index.android.bundle:79:142\n" +
            "invokeGuardedCallback@index.android.bundle:79:459\n" +
            "invokeGuardedCallbackAndCatchFirstError@index.android.bundle:79:580\n" +
            "c@index.android.bundle:95:365\n" +
            "a@index.android.bundle:95:567\n" +
            "v@index.android.bundle:146:501\n" +
            "g@index.android.bundle:146:604\n" +
            "forEach@[native code]\n" +
            "i@index.android.bundle:149:80\n" +
            "processEventQueue@index.android.bundle:146:1432\n" +
            "s@index.android.bundle:157:88\n" +
            "handleTopLevel@index.android.bundle:157:174\n" +
            "index.android.bundle:156:572\n" +
            "a@index.android.bundle:93:276\n" +
            "c@index.android.bundle:93:60\n" +
            "perform@index.android.bundle:177:596\n" +
            "batchedUpdates@index.android.bundle:188:464\n" +
            "i@index.android.bundle:176:358\n" +
            "i@index.android.bundle:93:90\n" +
            "u@index.android.bundle:93:150\n" +
            "_receiveRootNodeIDEvent@index.android.bundle:156:544\n" +
            "receiveTouches@index.android.bundle:156:918\n" +
            "value@index.android.bundle:29:3016\n" +
            "index.android.bundle:29:955\n" +
            "value@index.android.bundle:29:2417\n" +
            "value@index.android.bundle:29:927\n" +
            "[native code]",
    },

    IOS_REACT_NATIVE_1: {
        message: "Error: from issue #11",
        stack: `
      _exampleFunction@/home/test/project/App.js:125:13
      _depRunCallbacks@/home/test/project/node_modules/dep/index.js:77:45
      tryCallTwo@/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js:45:5
      doResolve@/home/test/project/node_modules/react-native/node_modules/promise/lib/core.js:200:13
    `,
    },

    IOS_REACT_NATIVE_2: {
        message: "Error: from issue https://github.com/facebook/react-native/issues/24382#issuecomment-489404970",
        stack:
            "s@33.js:1:531\n" +
            "b@1959.js:1:1469\n" +
            "onSocketClose@2932.js:1:727\n" +
            "value@81.js:1:1505\n" +
            "102.js:1:2956\n" +
            "value@89.js:1:1247\n" +
            "value@42.js:1:3311\n" +
            "42.js:1:822\n" +
            "value@42.js:1:2565\n" +
            "value@42.js:1:794\n" +
            "value@[native code]",
    },

    REACT_NATIVE_V8_EXCEPTION: {
        message: "Manually triggered crash to test Sentry reporting",
        name: "Error",
        stack: `Error: Manually triggered crash to test Sentry reporting
          at Object.onPress(index.android.bundle:2342:3773)
          at s.touchableHandlePress(index.android.bundle:214:2048)
          at s._performSideEffectsForTransition(index.android.bundle:198:9608)
          at s._receiveSignal(index.android.bundle:198:8309)
          at s.touchableHandleResponderRelease(index.android.bundle:198:5615)
          at Object.y(index.android.bundle:93:571)
          at P(index.android.bundle:93:714)`,
    },

    REACT_NATIVE_EXPO_EXCEPTION: {
        message: "Test Error Expo",
        name: "Error",
        stack: `onPress@/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3:595:658
          value@/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3:221:7656
          onResponderRelease@/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3:221:5666
          p@/data/user/0/com.sentrytest/files/.expo-internal/bundle-613EDD44F3305B9D75D4679663900F2BCDDDC326F247CA3202A3A4219FD412D3:96:385
          forEach@[native code]`,
    },

    REACT_INVARIANT_VIOLATION_EXCEPTION: {
        message:
            "Minified React error #31; visit https://reactjs.org/docs/error-decoder.html?invariant=31&args[]=object%20with%20keys%20%7B%7D&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings. ",
        name: "Invariant Violation",
        stack: `Invariant Violation: Minified React error #31; visit https://reactjs.org/docs/error-decoder.html?invariant=31&args[]=object%20with%20keys%20%7B%7D&args[]= for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
            at http://localhost:5000/static/js/foo.chunk.js:1:21738
            at a (http://localhost:5000/static/js/foo.chunk.js:1:21841)
            at ho (http://localhost:5000/static/js/foo.chunk.js:1:68735)
            at f (http://localhost:5000/:1:980)`,
    },

    REACT_PRODUCTION_ERROR: {
        message:
            "Minified React error #200; visit https://reactjs.org/docs/error-decoder.html?invariant=200 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.",
        name: "Error",
        stack: `Error: Minified React error #200; visit https://reactjs.org/docs/error-decoder.html?invariant=200 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.
          at http://localhost:5000/static/js/foo.chunk.js:1:21738
          at a (http://localhost:5000/static/js/foo.chunk.js:1:21841)
          at ho (http://localhost:5000/static/js/foo.chunk.js:1:68735)
          at f (http://localhost:5000/:1:980)`,
    },

    SAFARI_6: {
        message: "'null' is not an object (evaluating 'x.undef')",
        stack: "@http://path/to/file.js:48\n" + "dumpException3@http://path/to/file.js:52\n" + "onclick@http://path/to/file.js:82\n" + "[native code]",
        line: 48,
        sourceURL: "http://path/to/file.js",
    },

    SAFARI_7: {
        message: "'null' is not an object (evaluating 'x.undef')",
        name: "TypeError",
        stack: "http://path/to/file.js:48:22\n" + "foo@http://path/to/file.js:52:15\n" + "bar@http://path/to/file.js:108:107",
        line: 48,
        sourceURL: "http://path/to/file.js",
    },

    SAFARI_8: {
        message: "null is not an object (evaluating 'x.undef')",
        name: "TypeError",
        stack: "http://path/to/file.js:47:22\n" + "foo@http://path/to/file.js:52:15\n" + "bar@http://path/to/file.js:108:23",
        line: 47,
        column: 22,
        sourceURL: "http://path/to/file.js",
    },

    SAFARI_8_EVAL: {
        message: "Can't find variable: getExceptionProps",
        name: "ReferenceError",
        stack: "eval code\n" + "eval@[native code]\n" + "foo@http://path/to/file.js:58:21\n" + "bar@http://path/to/file.js:109:91",
        line: 1,
        column: 18,
    },

    SAFARI_9_NESTED_EVAL: {
        column: 39,
        line: 1,
        message: "message string",
        stack:
            "baz\n" +
            "foo\n" +
            "eval code\n" +
            "eval@[native code]\n" +
            "speak@http://localhost:8080/file.js:26:21\n" +
            "global code@http://localhost:8080/file.js:33:18",
    },

    SAFARI_EXTENSION_EXCEPTION: {
        message: "wat",
        name: "Error",
        stack: `Error: wat
      at ClipperError@safari-extension:(//3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/commons.js:223036:10)
      at safari-extension:(//3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/topee-content.js:3313:26)`,
    },

    SAFARI_EXTENSION_EXCEPTION_2: {
        message: `undefined is not an object (evaluating 'e.groups.includes')`,
        name: `TypeError`,
        stack: `isClaimed@safari-extension://com.grammarly.safari.extension.ext2-W8F64X92K3/ee7759dd/Grammarly.js:2:929865
        safari-extension://com.grammarly.safari.extension.ext2-W8F64X92K3/ee7759dd/Grammarly.js:2:1588410
        promiseReactionJob@[native code]`,
    },

    SAFARI_EXTENSION_EXCEPTION_3: {
        message: `undefined is not an object (evaluating 'e.groups.includes')`,
        name: `TypeError`,
        stack: `p_@safari-web-extension://46434E60-F5BD-48A4-80C8-A422C5D16897/scripts/content-script.js:29:33314
      safari-web-extension://46434E60-F5BD-48A4-80C8-A422C5D16897/scripts/content-script.js:29:56027
      promiseReactionJob@[native code]`,
    },

    SAFARI_WEB_EXTENSION_EXCEPTION: {
        message: "wat",
        name: "Error",
        stack: `Error: wat
      at ClipperError@safari-web-extension:(//3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/commons.js:223036:10)
      at safari-web-extension:(//3284871F-A480-4FFC-8BC4-3F362C752446/2665fee0/topee-content.js:3313:26)`,
    },

    SAFARI_12_NATIVE_CODE_EXCEPTION: {
        message: "test",
        name: "Error",
        stack: `fooIterator@http://localhost:5000/test:20:26
            map@[native code]
            foo@http://localhost:5000/test:19:22
            global code@http://localhost:5000/test:24:10`,
    },

    SAFARI_12_EVAL_EXCEPTION: {
        message: "aha",
        name: "Error",
        stack: `aha@http://localhost:5000/:19:22
            aha@[native code]
            callAnotherThing@http://localhost:5000/:20:16
            callback@http://localhost:5000/:25:23
            http://localhost:5000/:34:25
            map@[native code]
            test@http://localhost:5000/:33:26
            eval code
            eval@[native code]
            aha@http://localhost:5000/:39:9
            testMethod@http://localhost:5000/:44:10
            http://localhost:5000/:50:29`,
    },
};
