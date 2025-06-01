import { boxen } from "../dist/index.mjs";

const text = "Hello there !\nGeneral Kenobi !";

console.log("\n--- Left Alignment ---");
const leftAlignedBox = boxen(text, {
    headerText: "Left Aligned",
    textAlignment: "left",
});

console.log(leftAlignedBox);

console.log("\n--- Center Alignment ---");
const centerAlignedBox = boxen(text, {
    headerText: "Center Aligned",
    textAlignment: "center",
});

console.log(centerAlignedBox);

console.log("\n--- Right Alignment ---");
const rightAlignedBox = boxen(text, {
    headerText: "Right Aligned",
    textAlignment: "right",
});

console.log(rightAlignedBox);

console.log("\n--- Center Alignment with Padding ---");
const centerAlignedPaddedBox = boxen(text, {
    headerText: "Center Aligned + Padding",
    padding: 2,
    textAlignment: "center",
});

console.log(centerAlignedPaddedBox);
