// examples/pail/spinner/basic.js
import { createPail } from "@visulima/pail";

async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demo() {
    const logger = createPail({ interactive: true });

    // Simple spinner
    const spinner = logger.createSpinner({ name: "dots" });
    spinner.start("Loading data...");

    await delay(1000);
    spinner.text = "Processing...";

    await delay(1000);
    spinner.succeed("Completed successfully!");

    console.log("\n");
}

demo();
