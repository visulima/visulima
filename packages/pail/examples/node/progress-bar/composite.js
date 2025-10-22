// examples/node/progress-bar/composite.js
import { createPail } from "@visulima/pail";
import colorize from "@visulima/colorize";

console.log("\n");
const logger = createPail({ interactive: true });
console.log("📦 Composite Progress Bars with Colors Demo\n");

const doWork = (delay = 50) => new Promise((resolve) => setTimeout(resolve, delay));

// Demo 1: Upload and Processing
console.log("📤 Upload and Processing:\n");
const multiBar1 = logger.createMultiProgressBar({
    composite: true,
    format: colorize.bold("Combined  ") + "[{bar}]  " + colorize.blue("↑ {u}%") + "  " + colorize.green("→ {p}%"),
});

const upload = multiBar1.create(100, 0, { u: "0", p: "0" });
const process1 = multiBar1.create(100, 0, { u: "0", p: "0" });

// Set colors for each bar
multiBar1.setBarColor(upload, colorize.blue);
multiBar1.setBarColor(process1, colorize.green);

for (let i = 0; i <= 100; i += 1) {
    upload.update(i, { u: i, p: Math.max(0, i - 20) });
    process1.update(Math.max(0, i - 20), { u: i, p: Math.max(0, i - 20) });
    await doWork(30);
}

multiBar1.stop();
console.log("✅ Upload and Processing complete!\n");

// Demo 2: Read and Write
console.log("📝 Read and Write:\n");
const multiBar2 = logger.createMultiProgressBar({
    composite: true,
    format: colorize.bold("I/O Ops   ") + "[{bar}]  " + colorize.cyan("R {r}%") + "  " + colorize.yellow("W {w}%"),
});

const read = multiBar2.create(80, 0, { r: "0", w: "0" });
const write = multiBar2.create(80, 0, { r: "0", w: "0" });

// Set colors for each bar
multiBar2.setBarColor(read, colorize.cyan);
multiBar2.setBarColor(write, colorize.yellow);

for (let i = 0; i <= 80; i += 1) {
    read.update(i, { r: i, w: Math.max(0, i - 10) });
    write.update(Math.max(0, i - 10), { r: i, w: Math.max(0, i - 10) });
    await doWork(35);
}

multiBar2.stop();
console.log("✅ Read and Write complete!\n");

// Demo 3: Multi-source Download
console.log("⬇️  Multi-source Download:\n");
const multiBar3 = logger.createMultiProgressBar({
    composite: true,
    format: colorize.bold("Sources   ") + "[{bar}]  " + colorize.red("① {s1}%") + "  " + colorize.yellow("② {s2}%") + "  " + colorize.blue("③ {s3}%"),
});

const source1 = multiBar3.create(100, 0, { s1: "0", s2: "0", s3: "0" });
const source2 = multiBar3.create(100, 0, { s1: "0", s2: "0", s3: "0" });
const source3 = multiBar3.create(100, 0, { s1: "0", s2: "0", s3: "0" });

// Set colors for each bar
multiBar3.setBarColor(source1, colorize.red);
multiBar3.setBarColor(source2, colorize.yellow);
multiBar3.setBarColor(source3, colorize.blue);

for (let i = 0; i <= 100; i += 1) {
    // Different speeds for each source to show color transitions clearly
    // source1 (red): fast, completes early
    // source2 (yellow): medium speed, completes mid-way
    // source3 (blue): slow, completes last
    source1.update(i, { s1: i, s2: Math.min(100, Math.floor(i * 0.7)), s3: Math.min(100, Math.floor(i * 0.4)) });
    source2.update(Math.min(100, Math.floor(i * 0.7)), { s1: i, s2: Math.min(100, Math.floor(i * 0.7)), s3: Math.min(100, Math.floor(i * 0.4)) });
    source3.update(Math.min(100, Math.floor(i * 0.4)), { s1: i, s2: Math.min(100, Math.floor(i * 0.7)), s3: Math.min(100, Math.floor(i * 0.4)) });
    await doWork(40);
}

multiBar3.stop();
console.log("✅ All sources downloaded!\n");

// Demo 4: Different styles with colors
console.log("🎨 Rect Style with Colors:\n");
const multiBar4 = logger.createMultiProgressBar({
    composite: true,
    style: "rect",
    format: colorize.bold("Rect      ") + "[{bar}]  " + colorize.magenta("Style1 {s1}%") + "  " + colorize.cyan("Style2 {s2}%"),
});

const style1 = multiBar4.create(100, 0, { s1: "0", s2: "0" });
const style2 = multiBar4.create(100, 0, { s1: "0", s2: "0" });

// Set colors for each bar
multiBar4.setBarColor(style1, colorize.magenta);
multiBar4.setBarColor(style2, colorize.cyan);

for (let i = 0; i <= 100; i += 1) {
    style1.update(i, { s1: i, s2: Math.max(0, i - 30) });
    style2.update(Math.max(0, i - 30), { s1: i, s2: Math.max(0, i - 30) });
    await doWork(20);
}

multiBar4.stop();
console.log("✅ Rect style complete!\n");

console.log("✨ All composite progress bars with colors complete!\n");
