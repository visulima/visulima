/**
 * Progress Bar Styles Example
 *
 * This example demonstrates different progress bar styles and modes
 * available in the Pail progress bar system, similar to cli-progress.
 */

import { createPail, ProgressBar } from "@visulima/pail";

console.log("\n");

// Create an interactive logger
const logger = createPail({ interactive: true });

console.log("🚀 Pail Progress Bar Styles Demo\n");

// Function to simulate work
function doWork(delay = 50) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

// Demo 1: Single Progress Bar with different styles
console.log("📊 Single Progress Bar Styles:\n");

const styles = ["shades_classic", "shades_grey", "rect", "filled", "solid", "ascii"];

for (const style of styles) {
    const bar = logger.createProgressBar({
        total: 20,
        style: style,
        format: `${style}: [{bar}] {percentage}% | {value}/{total}`,
        width: 30,
    });

    bar.start();

    for (let i = 0; i <= 20; i++) {
        bar.update(i);
        await doWork(30);
    }

    bar.stop();
    console.log(); // Empty line between styles
}

// Demo 2: Custom Progress Bar
console.log("🎨 Custom Progress Bar:\n");

const customBar = logger.createProgressBar({
    total: 50,
    format: "Custom: [{bar}] {percentage}% | ETA: {eta}s | Speed: {speed} items/s",
    barCompleteChar: "🚀",
    barIncompleteChar: "⚪",
    width: 20,
});

customBar.start();

for (let i = 0; i <= 50; i++) {
    const speed = Math.round(Math.random() * 10 + 5);
    customBar.update(i, { speed });
    await doWork(40);
}

customBar.stop();
console.log();

// Demo 3: Multi Progress Bars
console.log("📈 Multi Progress Bars:\n");

const multiBar = logger.createMultiProgressBar({
    format: "Task {task}: [{bar}] {percentage}% | {value}/{total}",
});

const bar1 = multiBar.create(30, 0, { task: "A" });
const bar2 = multiBar.create(25, 0, { task: "B" });
const bar3 = multiBar.create(35, 0, { task: "C" });

// Update bars simultaneously - scale each bar's progress proportionally
const maxTotal = 35; // Maximum total among all bars
for (let i = 0; i <= maxTotal; i++) {
    // Scale progress for each bar based on its total relative to maxTotal
    const progress1 = Math.round((i / maxTotal) * 30); // Scale to bar1's total (30)
    const progress2 = Math.round((i / maxTotal) * 25); // Scale to bar2's total (25)
    const progress3 = Math.round((i / maxTotal) * 35); // Scale to bar3's total (35)

    bar1.update(progress1);
    bar2.update(progress2);
    bar3.update(progress3);

    await doWork(150); // Slow enough to see the effect
}

multiBar.stop();
console.log();

// Demo 4: Progress Bar with Payload
console.log("📦 Progress Bar with Payload:\n");

const payloadBar = logger.createProgressBar({
    total: 100,
    format: "Downloading {filename}: [{bar}] {percentage}% | Speed: {speed} MB/s | ETA: {eta}s",
    width: 40,
});

payloadBar.start(undefined, 0, {
    filename: "large-file.zip",
    speed: "0.0",
});

for (let i = 0; i <= 100; i++) {
    const speed = (Math.random() * 5 + 1).toFixed(1);
    payloadBar.update(i, {
        filename: "large-file.zip",
        speed,
    });
    await doWork(30);
}

payloadBar.stop();
console.log();

// Demo 5: Increment-based updates
console.log("🔢 Increment-based Progress Bar:\n");

const incrementBar = logger.createProgressBar({
    total: 100,
    format: "Processing: [{bar}] {percentage}% | {value}/{total} items",
    width: 50,
});

incrementBar.start();

for (let i = 0; i < 100; i++) {
    incrementBar.increment(1, { current: i + 1 });
    await doWork(20);
}

incrementBar.stop();

console.log("\n✨ Progress Bar Demo Complete!\n");
