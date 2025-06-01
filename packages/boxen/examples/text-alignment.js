#!/usr/bin/env node

import { boxen } from "../dist/index.mjs";

const text = "Hello there !\nGeneral Kenobi !";

console.log("\n--- Left Alignment ---");
const leftAlignedBox = boxen(text, {
    textAlignment: "left",
    headerText: "Left Aligned",
});
console.log(leftAlignedBox);

console.log("\n--- Center Alignment ---");
const centerAlignedBox = boxen(text, {
    textAlignment: "center",
    headerText: "Center Aligned",
});
console.log(centerAlignedBox);

console.log("\n--- Right Alignment ---");
const rightAlignedBox = boxen(text, {
    textAlignment: "right",
    headerText: "Right Aligned",
});
console.log(rightAlignedBox);

console.log("\n--- Center Alignment with Padding ---");
const centerAlignedPaddedBox = boxen(text, {
    textAlignment: "center",
    headerText: "Center Aligned + Padding",
    padding: 2,
});
console.log(centerAlignedPaddedBox); 