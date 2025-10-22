// examples/pail/spinner/colors.js
import { createPail } from "@visulima/pail";

async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demo() {
    const logger = createPail({ interactive: true });

    console.log("=== Spinners with Custom Colors and Styles ===\n");

    // Single spinner with color and bold
    const blueSpinner = logger.createSpinner({
        name: "dots",
        style: {
            color: "blue",
            bold: true,
        },
        prefixText: "[API]",
    });
    blueSpinner.start("Fetching user data...");
    await delay(2000);
    blueSpinner.succeed("User data loaded!");

    console.log();

    // Multiple spinners with different colors and styles
    const multiSpinner = logger.createMultiSpinner({ name: "dots2" });

    const apiSpinner = multiSpinner.create("Connecting to API...", {
        style: {
            color: "blue",
            bold: true,
        },
    });

    const dbSpinner = multiSpinner.create("Connecting to database...", {
        style: {
            color: "green",
            italic: true,
        },
    });

    const cacheSpinner = multiSpinner.create("Warming cache...", {
        style: {
            color: "yellow",
            underline: true,
        },
    });

    apiSpinner.start();
    dbSpinner.start();
    cacheSpinner.start();

    await delay(1500);
    apiSpinner.text = "API connected!";
    apiSpinner.succeed("API ready");

    await delay(1000);
    dbSpinner.text = "Database synced!";
    dbSpinner.succeed("Database ready");

    await delay(1000);
    cacheSpinner.text = "Cache warmed!";
    cacheSpinner.succeed("Cache ready");

    multiSpinner.stop();

    console.log("\n=== Using HEX colors ===\n");

    // Spinner with HEX color
    const hexSpinner = logger.createSpinner({
        name: "dots",
        style: {
            hex: "#FF75D1",
            bold: true,
        },
    });
    hexSpinner.start("Processing with custom color...");
    await delay(1500);
    hexSpinner.succeed("Process complete!");

    console.log("\n=== Using RGB colors ===\n");

    // Spinner with RGB color
    const rgbSpinner = logger.createSpinner({
        name: "dots",
        style: {
            rgb: [100, 200, 255],
            italic: true,
        },
    });
    rgbSpinner.start("Running RGB colored spinner...");
    await delay(1500);
    rgbSpinner.succeed("Done!");
}

demo();
