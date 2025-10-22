// packages/pail/examples/node/progress-bar/composite-dynamic.js
import { createPail } from "@visulima/pail";
import colorize from "@visulima/colorize";

console.log("\n" + colorize.bold("=== Composite Progress Bar - Dynamic Color Change Demo ===\n"));

const logger = createPail({ interactive: true });

// Scenario: Two bars progressing at different speeds
// Red progresses to 100%, Yellow to 100% (but slower)
// Watch RED color appear first, then RED wins and fills completely
console.log(colorize.bold("Watch as colors change based on progress:\n"));

const multiBar = logger.createMultiProgressBar({
    composite: true,
    format: colorize.bold("Progress ") + "[{bar}]  " + colorize.red("Red {r}%") + "  " + colorize.yellow("Yellow {y}%"),
});

const barRed = multiBar.create(100, 0, { r: "0", y: "0" });
const barYellow = multiBar.create(100, 0, { r: "0", y: "0" });

multiBar.setBarColor(barRed, colorize.red);
multiBar.setBarColor(barYellow, colorize.yellow);

// Simulate slow progress change
// Red: 0→100% (fast)
// Yellow: 0→100% (slow)
const doWork = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let redValue = 0;
let yellowValue = 0;

const animationSteps = 20;

(async () => {
    // Phase 1: Both progress together (RED starts at 30%, YELLOW at 0%)
    console.log(colorize.bold("Phase 1: Both progress together\n"));
    for (let step = 0; step <= animationSteps / 2; step += 1) {
        redValue = 30 + Math.round((step / (animationSteps / 2)) * 20); // Red: 30% → 50%
        yellowValue = Math.round((step / (animationSteps / 2)) * 50); // Yellow: 0% → 50%

        barRed.update(redValue, { r: String(redValue), y: String(yellowValue) });
        barYellow.update(yellowValue, { r: String(redValue), y: String(yellowValue) });

        await doWork(300);
    }

    // RED PAUSES at 50%, YELLOW CONTINUES
    console.log("\n" + colorize.bold.inverse(" ⏸  RED PAUSES at 50% - YELLOW continues! ") + "\n");
    for (let i = 0; i < 3; i += 1) {
        await doWork(300);
    }

    // Phase 2: RED paused, YELLOW continues to 100%
    console.log(colorize.bold("Phase 2: RED stays at 50%, YELLOW rushes to 100%\n"));
    for (let step = Math.floor(animationSteps / 2); step <= animationSteps; step += 1) {
        redValue = 50; // RED STAYS PAUSED
        yellowValue = Math.round((step / animationSteps) * 100);

        barRed.update(redValue, { r: String(redValue), y: String(yellowValue) });
        barYellow.update(yellowValue, { r: String(redValue), y: String(yellowValue) });

        await doWork(300);
    }

    // YELLOW WINS!
    multiBar.stop();
    console.log("\n" + colorize.bold.inverse(" 🎉 YELLOW WINS at 100%, RED still at 50%! ") + "\n");
    for (let i = 0; i < 3; i += 1) {
        await doWork(300);
    }

    console.log(colorize.bold("Color Change Analysis:"));
    console.log("───────────────────────\n");
    console.log(colorize.red("Phase 1 (0-50%)") + ":");
    console.log("  • Red: 30-50%, Yellow: 0-50%");
    console.log("  • Red starts ahead but YELLOW progresses faster\n");

    console.log(colorize.yellow("Phase 2 (50-100%)") + ":");
    console.log("  • Red: PAUSED at 50%, Yellow: 50-100%");
    console.log("  • YELLOW races ahead and WINS!\n");

    console.log(colorize.bold("✓ Yellow had smaller progress, so it was always visible!\n"));

    // Custom Bar Styles Example
    console.log(colorize.bold("\n=== Custom Bar Styles ===\n"));

    const multiBarCustom = logger.createMultiProgressBar({
        composite: true,
        format: colorize.bold("Custom  ") + "[{bar}]  " + colorize.green("✔ {v}%") + "  " + colorize.magenta("◆ {m}%"),
    });

    const barV = multiBarCustom.create(100, 0, { v: "0", m: "0" });
    const barM = multiBarCustom.create(100, 0, { v: "0", m: "0" });

    multiBarCustom.setBarColor(barV, colorize.green);
    multiBarCustom.setBarColor(barM, colorize.magenta);

    // Animate with custom styles
    for (let step = 0; step <= animationSteps; step += 1) {
        const vVal = Math.round((step / animationSteps) * 100);
        const mVal = Math.round((step / animationSteps) * 80);

        barV.update(vVal, { v: String(vVal), m: String(mVal) });
        barM.update(mVal, { v: String(vVal), m: String(mVal) });

        await doWork(200);
    }

    multiBarCustom.stop();

    console.log("\n" + colorize.bold("✓ Custom colors work smoothly with composite bars!\n"));

    // Rect Bar Style Example
    console.log(colorize.bold("=== Rect Bar Style ===\n"));

    const multiBarRect = logger.createMultiProgressBar({
        composite: true,
        style: "rect",
        format: colorize.bold("Rect    ") + "[{bar}]  " + colorize.cyan("◆ {x}%") + "  " + colorize.yellow("★ {y}%"),
    });

    const barX = multiBarRect.create(100, 0, { x: "0", y: "0" });
    const barY = multiBarRect.create(100, 0, { x: "0", y: "0" });

    multiBarRect.setBarColor(barX, colorize.cyan);
    multiBarRect.setBarColor(barY, colorize.yellow);

    // Animate with rect style
    for (let step = 0; step <= animationSteps; step += 1) {
        const xVal = Math.round((step / animationSteps) * 100);
        const yVal = Math.round((step / animationSteps) * 70);

        barX.update(xVal, { x: String(xVal), y: String(yVal) });
        barY.update(yVal, { x: String(xVal), y: String(yVal) });

        await doWork(200);
    }

    multiBarRect.stop();

    console.log("\n" + colorize.bold("✓ Rect style works great with composite bars!\n"));
})();
