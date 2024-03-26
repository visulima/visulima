import { createPail } from "@visulima/pail";
import { SimpleReporter } from "@visulima/pail/reporter";

const pail = createPail({
    reporter: new SimpleReporter(),
});

console.log("------------------ DEFAULT ------------------", "\n");

pail.complete("Hello World!");

console.log("------------------ TRACE ------------------", "\n");

const traceLevel = pail.clone({ logLevel: "trace" });

traceLevel.trace("This is a trace message");

console.log("------------------ TIME ------------------", "\n");

pail.time("test");
pail.time();
pail.time();

setTimeout(() => {
    pail.timeEnd();
    pail.timeEnd();
    pail.timeEnd("test");
}, 500);

console.log("------------------ SCOPE NEW CUSTOM ------------------", "\n");

const newLogger = pail.scope("new custom");

newLogger.complete("Hello World!");

console.log("------------------ SCOPE CLIENT|SERVER ------------------", "\n");

const newLogger2 = newLogger.scope("client", "server");

newLogger2.complete("Logger 2 - Hello World! ".repeat(50));
newLogger2.error({
    message: "Logger 2 - Hello World! ".repeat(50),
    suffix: "test",
});

const newError = new Error("New Error");

newLogger2.error(
    new Error("Hello World!", {
        cause: newError,
    }),
);
newLogger2.warn(new TypeError("Hello World! ".repeat(50)));

newLogger2.notice({
    message: "Hello World!",
    suffix: "suffix",
    prefix: "prefix",
});

console.log("------------------ REPEATER ------------------", "\n");

function wait(delay) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}

const repeaterLogger = createPail({
    throttle: 100,
});

for (let i = 0; i < 10; i++) {
    repeaterLogger.info("repeated message");
}

await wait(300);

class TestFunctionCall {
    getParams() {
        return Array.from(arguments);
    }
    count(arg1, arg2) {
        let methodName = "count";
        return { method: methodName, args: this.getParams.apply(this, arguments) };
    }
}
let test = new TestFunctionCall();

pail.info(test.count("a", "b"));

console.log("------------------ GROUP ------------------\n");

const newLogger3 = newLogger.scope("group");

newLogger3.log("This is the outer level");
newLogger3.group();
newLogger3.log("Level 2");
newLogger3.error(
    new Error("Hello World!", {
        cause: newError,
    }),
);
newLogger3.group();
newLogger3.log("Level 3");
newLogger3.warn("More of level 3");
newLogger3.groupEnd();
newLogger3.log("Back to level 2");
newLogger3.groupEnd();
newLogger3.log("Back to the outer level");
