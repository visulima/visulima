import { createPail } from "@visulima/pail";

console.log("\n");

const interactive = createPail({ interactive: true });

interactive.await("[%d/4] - Process A", 1);

setTimeout(() => {
    interactive.success("[%d/4] - Process A", 2);
    setTimeout(() => {
        interactive.await("[%d/4] - Process B", 3);
        setTimeout(() => {
            interactive.error("[%d/4] - Process B", 4);
            setTimeout(() => {}, 1000);
        }, 1000);
    }, 1000);
}, 1000);
