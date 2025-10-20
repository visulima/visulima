import { createPail } from "@visulima/pail";
import { PrettyReporter } from "@visulima/pail/reporter/pretty";

const pail = createPail({
    reporters: [new PrettyReporter()],
});

console.log("------------------ DEFAULT ------------------", "\n");

pail.alert("[1, 2, 3, 4, 5]", [1, 2, 3, 4, 5], ["teset", "test"], { test: "test", 1: 2 });
pail.await("Hello World!");
pail.complete("Hello World!");
pail.critical("Hello World!");
pail.debug("Hello World!");
pail.emergency("Hello World!");
pail.error("Hello World!");
pail.info("Hello World!");
pail.log("Hello World!");
pail.notice("Hello World!");
pail.pending("Hello World!");
pail.start("Hello World!");
pail.stop("Hello World!");
pail.success("Hello World!");
pail.trace("Hello World!");
pail.wait("Hello World!");
pail.warn("Hello World!");
pail.watch("Hello World!");
// should have a line break and 4 spaces
pail.info("\n    test ");

pail.info({
    message: "Hello World!",
    suffix: "suffix",
    prefix: "prefix",
    context: [
        {
            test: "test",
        },
    ],
});

console.log("\n", "------------------ TIME ------------------", "\n");

pail.time("test");
pail.time();
pail.time();

setTimeout(() => {
    pail.timeEnd();
    pail.timeEnd();
    pail.timeEnd("test");
}, 500);

console.log("\n", "------------------ SCOPE NEW CUSTOM ------------------", "\n");

const newLogger = pail.scope("new custom");

newLogger.complete("Hello World!");

console.log("\n", "------------------ SCOPE CLIENT|SERVER ------------------", "\n");

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

console.log("\n", "------------------ REPEATER ------------------", "\n");

function wait(delay) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay);
    });
}

const repeaterLogger = createPail({
    throttle: 100,
    reporters: [new PrettyReporter()],
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

console.log("\n", "------------------ GROUP ------------------\n");

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
