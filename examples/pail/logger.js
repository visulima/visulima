import { join } from "path";
import Stream from "node:stream";
import { Buffer } from "node:buffer";

import { pail, createPail, callerProcessor } from "@visulima/pail";
import JsonReporter from "@visulima/pail/reporter/json";
import JsonFileReporter from "@visulima/pail/reporter/json-file";

const __dirname = new URL(".", import.meta.url).pathname;

// pail.complete("Hello World!");
//
// const newLogger = pail.scope("new custom");
//
// newLogger.complete("Hello World!");
//
// const newLogger2 = newLogger.scope("client", "server");
//
// newLogger2.complete("Logger 2 - Hello World! ".repeat(50));
// newLogger2.error({
//     message: "Logger 2 - Hello World! ".repeat(50),
//     suffix: "test",
// });
//
const newError = new Error("New Error");
//
// newLogger2.error(
//     new Error("Hello World!", {
//         cause: newError,
//     }),
// );
// newLogger2.warn(new TypeError("Hello World! ".repeat(50)));
//
// newLogger2.note({
//     message: "Hello World!",
//     suffix: "suffix",
//     prefix: "prefix",
// });

// function wait(delay) {
//     return new Promise((resolve) => {
//         setTimeout(resolve, delay);
//     });
// }
//
// const repeaterLogger = createPail({
//     throttle: 100,
// });
//
// for (let i = 0; i < 10; i++) {
//     repeaterLogger.info("repeated message");
// }
//
// await wait(300);

const jsonLogger = createPail({
    processors: [callerProcessor],
    reporters: [
        new JsonReporter(),
        new JsonFileReporter({
            filePath: join(__dirname, "test.log"),
        }),
    ],
});

jsonLogger.info("Hello Json!");

jsonLogger.info({
    message: "Hello Json!",
    suffix: "suffix",
    prefix: "prefix",
    context: {
        test: new ArrayBuffer(1),
        stream: new Stream.Stream(),
        buffer: Buffer.alloc(1)
    }
});

jsonLogger.error(
    new Error("Hello Json!", {
        cause: newError,
    }),
);
jsonLogger.warn(new TypeError("Hello Json!"));

class TestFunctionCall {
    getParams() {
        return Array.from(arguments)
    }
    count(arg1, arg2) {
        let methodName = 'count'
        return {method: methodName, args: this.getParams.apply(this, arguments)}
    }
}
let test = new TestFunctionCall()

pail.info(test.count('a', 'b'));
