import { Pail } from "@visulima/pail";

const logger = new Pail({
    scope: "custom",
    display: {
        date: true,
        timestamp: true,
        filename: true,
    },
});

logger.complete("Hello World!");

const newLogger = logger.scope("new custom");

newLogger.complete("Hello World!");

const newLogger2 = newLogger.scope(["client", "server"]);

newLogger2.complete("Hello World! ".repeat(50));
newLogger2.error({
    message: "Hello World! ".repeat(50),
    suffix: "test"
});
newLogger2.error(new Error("Hello World! ".repeat(50)));

newLogger2.note("Hello World!");
