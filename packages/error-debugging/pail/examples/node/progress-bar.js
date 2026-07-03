/**
 * Progress Bar Example
 *
 * This example demonstrates how to create an interactive progress bar
 * using the Pail InteractiveManager. It shows:
 * - Setting up an interactive logger
 * - Creating a visual progress bar with Unicode characters
 * - Updating the display dynamically
 * - Proper cleanup when complete
 */

import { createPail } from "@visulima/pail";

console.log("\n");

// Create an interactive logger
const logger = createPail({ interactive: true });

const TOTAL_STEPS = 100;
let currentStep = 0;

const interactiveManager = logger.getInteractiveManager();

if (!interactiveManager) {
    console.error("Interactive mode not available (not a TTY)");
    process.exit(1);
}

interactiveManager.hook();

// Function to create a progress bar string
function createProgressBar(completed, total, width = 40) {
    const percentage = Math.round((completed / total) * 100);
    const filled = Math.round((completed / total) * width);
    const empty = width - filled;

    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `${bar} ${percentage}% (${completed}/${total})`;
}

// Function to simulate some work
function doWork() {
    // Simulate variable work time
    const workTime = Math.random() * 100 + 50;
    return new Promise((resolve) => setTimeout(resolve, workTime));
}

// Start the progress
interactiveManager.update("stdout", ["🚀 Starting progress bar example...", "", createProgressBar(0, TOTAL_STEPS), "", "Processing items..."]);

// Simulate doing work asynchronously and update progress
(async () => {
    for (let i = 0; i < TOTAL_STEPS; i++) {
        await doWork();

        // Update progress after each work item completes
        currentStep = i + 1;
        const progressBar = createProgressBar(currentStep, TOTAL_STEPS);
        const statusMessage = currentStep % 10 === 0 ? `Processing item ${currentStep}...` : "Processing items...";

        interactiveManager.update("stdout", ["🚀 Starting progress bar example...", "", progressBar, "", statusMessage]);

        // Small delay to make progress visible
        if (currentStep < TOTAL_STEPS) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }

    // Final completion update
    interactiveManager.update("stdout", [
        "✅ Progress bar example completed!",
        "",
        createProgressBar(TOTAL_STEPS, TOTAL_STEPS),
        "",
        `Processed ${TOTAL_STEPS} items successfully.`,
    ]);

    // Clean up after a short delay
    setTimeout(() => {
        interactiveManager.unhook(false);
    }, 2000);
})();
