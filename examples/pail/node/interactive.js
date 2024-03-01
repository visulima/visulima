import { createPail } from "@visulima/pail";

console.log("\n");

const pail = createPail();

const interactive = createPail({ interactive: true });

pail.info("This is a log message 1");

setTimeout(() => {
    interactive.await("[%d/4] - Process A", 1);
    setTimeout(() => {
        interactive.success("[%d/4] - Process A", 2);
        setTimeout(() => {
            interactive.await("[%d/4] - Process B", 3);
            setTimeout(() => {
                interactive.error("[%d/4] - Process B", 4);
            }, 1000);
        }, 1000);
    }, 1000);
});

pail.info("This is a log message 2");
pail.info("This is a log message 3");
pail.info("This is a log message 4");
