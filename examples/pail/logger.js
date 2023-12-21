import { pail, createPail, fileProcessor } from "@visulima/pail";
import JsonReporter from "@visulima/pail/reporter/json";

pail.complete("Hello World!");

const newLogger = pail.scope("new custom");

newLogger.complete("Hello World!");

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

newLogger2.note({
    message: "Hello World!",
    suffix: "suffix",
    prefix: "prefix",
});

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

const jsonLogger = createPail({
    processors: [fileProcessor],
    reporters: [new JsonReporter()],
});

jsonLogger.note({
    message: "Hello World!",
    suffix: "suffix",
    prefix: "prefix",
});

jsonLogger.error(
    new Error("Hello World!", {
        cause: newError,
    }),
);
jsonLogger.warn(new TypeError("Hello World!"));
