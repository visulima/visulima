// examples/pail/spinner/multi.js
import { createPail } from "@visulima/pail";

async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demo() {
    const logger = createPail({ interactive: true });

    const multiSpinner = logger.createMultiSpinner({ name: "dots" });

    const spinner1 = multiSpinner.create("Task 1");
    const spinner2 = multiSpinner.create("Task 2");
    const spinner3 = multiSpinner.create("Task 3");

    spinner1.start();
    spinner2.start();
    spinner3.start();

    await delay(800);
    spinner1.text = "Task 1: 50%";

    await delay(800);
    spinner2.text = "Task 2: 50%";

    await delay(800);
    spinner3.text = "Task 3: 50%";

    await delay(1000);

    spinner1.succeed("Task 1 completed!");
    spinner2.succeed("Task 2 completed!");
    spinner3.succeed("Task 3 completed!");

    multiSpinner.stop();

    console.log("\nAll tasks finished!");
}

demo();
