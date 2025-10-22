/**
 * Custom Gradient Progress Bars Example
 *
 * This example demonstrates how to create smooth gradient animations
 * using character arrays for both barCompleteChar and barIncompleteChar.
 * This is perfect for creating visually appealing progress indicators.
 */

import { createPail } from "@visulima/pail";

console.log("\n");

// Create an interactive logger
const logger = createPail({ interactive: true });

console.log("🌈 Custom Gradient Progress Bars\n");

// Function to simulate work
function doWork(delay = 50) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

// Example 1: Shade gradient (light to dark)
console.log("📊 Shade Gradient (Light to Dark):\n");

const shadeGradient = logger.createProgressBar({
    total: 40,
    barCompleteChar: ["░", "▒", "▓", "█"],
    barIncompleteChar: " ",
    format: "Shade:     [{bar}] {percentage}%",
    width: 30,
});

shadeGradient.start();
for (let i = 0; i <= 40; i++) {
    shadeGradient.update(i);
    await doWork(40);
}
shadeGradient.stop();
console.log();

// Example 2: Block gradient (small to large)
console.log("📦 Block Gradient:\n");

const blockGradient = logger.createProgressBar({
    total: 40,
    barCompleteChar: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"],
    barIncompleteChar: " ",
    format: "Block:     [{bar}] {percentage}%",
    width: 30,
});

blockGradient.start();
for (let i = 0; i <= 40; i++) {
    blockGradient.update(i);
    await doWork(40);
}
blockGradient.stop();
console.log();

// Example 3: Color gradient with emoji (cold to hot)
console.log("🔥 Temperature Gradient:\n");

const tempGradient = logger.createProgressBar({
    total: 40,
    barCompleteChar: ["🔵", "🟢", "🟡", "🟠", "🔴"],
    barIncompleteChar: "⚪",
    format: "Temp:      [{bar}] {percentage}%",
    width: 30,
});

tempGradient.start();
for (let i = 0; i <= 40; i++) {
    tempGradient.update(i);
    await doWork(40);
}
tempGradient.stop();
console.log();

// Example 4: Download progress
console.log("⬇️  Download Gradient:\n");

const downloadGradient = logger.createProgressBar({
    total: 40,
    barCompleteChar: ["🟡", "🟠", "🔴"],
    barIncompleteChar: "⚫",
    format: "Download:  [{bar}] {percentage}%",
    width: 30,
});

downloadGradient.start();
for (let i = 0; i <= 40; i++) {
    downloadGradient.update(i);
    await doWork(40);
}
downloadGradient.stop();
console.log();

// Example 5: Processing stages
console.log("⚙️  Processing Stages:\n");

const stagesGradient = logger.createProgressBar({
    total: 40,
    barCompleteChar: ["⊙", "◉", "◎", "●", "■"],
    barIncompleteChar: "·",
    format: "Process:   [{bar}] {percentage}%",
    width: 30,
});

stagesGradient.start();
for (let i = 0; i <= 40; i++) {
    stagesGradient.update(i);
    await doWork(40);
}
stagesGradient.stop();
console.log();

// Example 6: Subtle fade
console.log("👻 Subtle Fade:\n");

const fadeGradient = logger.createProgressBar({
    total: 40,
    barCompleteChar: ["▲", "▶", "▼", "◀"],
    barIncompleteChar: "△",
    format: "Fade:      [{bar}] {percentage}%",
    width: 30,
});

fadeGradient.start();
for (let i = 0; i <= 40; i++) {
    fadeGradient.update(i);
    await doWork(40);
}
fadeGradient.stop();

console.log("\n✨ Gradient Progress Bars Complete!\n");
