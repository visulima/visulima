import { createPail } from "@visulima/pail";
import colorize from "@visulima/colorize";

console.log("\n" + colorize.bold("=== Composite Progress Bar Color Test ===\n"));

const logger = createPail({ interactive: true });

// Test 1: Simple 3-bar test with controlled progress
console.log(colorize.bold("Test 1: Three bars at different progress levels"));
console.log("Red (① 30%), Yellow (② 60%), Blue (③ 90%)\n");

const multiBar1 = logger.createMultiProgressBar({
    composite: true,
    format: colorize.bold("Mix      ") + "[{bar}]  " + colorize.red("R {r}%") + "  " + colorize.yellow("Y {y}%") + "  " + colorize.blue("B {b}%"),
});

const bar1 = multiBar1.create(100, 0, { r: "0", y: "0", b: "0" });
const bar2 = multiBar1.create(100, 0, { r: "0", y: "0", b: "0" });
const bar3 = multiBar1.create(100, 0, { r: "0", y: "0", b: "0" });

// Update bars to show the test state
bar1.update(30, { r: "30", y: "60", b: "90" });
bar2.update(60, { r: "30", y: "60", b: "90" });
bar3.update(90, { r: "30", y: "60", b: "90" });

// Set colors after updating to render once
multiBar1.setBarColor(bar1, colorize.red);
multiBar1.setBarColor(bar2, colorize.yellow);
multiBar1.setBarColor(bar3, colorize.blue);

multiBar1.stop();
console.log("\n" + colorize.bold("Expected:"));
console.log("- Left part (0-30%): Should show RED (█)");
console.log("- Middle part (30-60%): Should show RED + YELLOW blend (▓)");
console.log("- Right part (60-90%): Should show RED + YELLOW + BLUE blend (▒)");
console.log("- Far right (90-100%): Should show lighter blend\n");

// Test 2: Two overlapping bars
console.log(colorize.bold("\nTest 2: Two overlapping bars"));
console.log("Red (① 50%), Blue (③ 80%)\n");

const multiBar2 = logger.createMultiProgressBar({
    composite: true,
    format: colorize.bold("2-bars   ") + "[{bar}]  " + colorize.red("R {r}%") + "  " + colorize.blue("B {b}%"),
});

const bar4 = multiBar2.create(100, 0, { r: "0", b: "0" });
const bar5 = multiBar2.create(100, 0, { r: "0", b: "0" });

multiBar2.setBarColor(bar4, colorize.red);
multiBar2.setBarColor(bar5, colorize.blue);

bar4.update(50, { r: "50", b: "80" });
bar5.update(80, { r: "50", b: "80" });

multiBar2.stop();

console.log(colorize.bold("\nExpected:"));
console.log("- Left part (0-50%): RED only (█)");
console.log("- Middle part (50-80%): RED + BLUE blend (▓)");
console.log("- Right part (80-100%): BLUE only (█)\n");

// Test 3: All equal progress
console.log(colorize.bold("Test 3: All bars at 70% (should show smooth blend)"));
console.log("Red (① 70%), Yellow (② 70%), Blue (③ 70%)\n");

const multiBar3 = logger.createMultiProgressBar({
    composite: true,
    format: colorize.bold("Equal    ") + "[{bar}]  " + colorize.red("R {r}%") + "  " + colorize.yellow("Y {y}%") + "  " + colorize.blue("B {b}%"),
});

const bar6 = multiBar3.create(100, 0, { r: "0", y: "0", b: "0" });
const bar7 = multiBar3.create(100, 0, { r: "0", y: "0", b: "0" });
const bar8 = multiBar3.create(100, 0, { r: "0", y: "0", b: "0" });

multiBar3.setBarColor(bar6, colorize.red);
multiBar3.setBarColor(bar7, colorize.yellow);
multiBar3.setBarColor(bar8, colorize.blue);

bar6.update(70, { r: "70", y: "70", b: "70" });
bar7.update(70, { r: "70", y: "70", b: "70" });
bar8.update(70, { r: "70", y: "70", b: "70" });

multiBar3.stop();

console.log(colorize.bold("\nExpected:"));
console.log("- Full bar (0-70%): Cycles through colors creating blend");
console.log("- Shades progress: ░ (lightest) → ▒ (light) → ▓ (medium) → █ (solid)\n");

console.log(colorize.bold("Character meanings:"));
console.log("- █ (solid): Single or mostly one color");
console.log("- ▓ (medium): Two colors blending");
console.log("- ▒ (light): Three colors blending");
console.log("- ░ (lightest): Four+ colors blending\n");
