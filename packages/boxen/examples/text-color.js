#!/usr/bin/env node

import { boxen } from "../dist/index.mjs";
import { bgRed, blue, green, yellow } from "@visulima/colorize";

const text = "This text has a custom color!";

console.log("\n--- Custom Text Color (bgRed) ---");
const customColorBox = boxen(text, {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    textColor: (t) => bgRed(t),
    headerText: "Custom Color (bgRed)",
});
console.log(customColorBox);

console.log("\n--- Custom Header Text Color (blue) ---");
const customHeaderColorBox = boxen("Content with blue header", {
    headerText: "Blue Header",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    headerTextColor: (t) => blue(t),
});
console.log(customHeaderColorBox);

console.log("\n--- Custom Footer Text Color (green) ---");
const customFooterColorBox = boxen("Content with green footer", {
    footerText: "Green Footer",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    footerTextColor: (t) => green(t),
    textAlignment: "center",
});
console.log(customFooterColorBox);

console.log("\n--- All Custom Colors (yellow text, blue header, green footer) ---");
const allCustomColorsBox = boxen("Colorful content!", {
    headerText: "Colorful Header",
    footerText: "Colorful Footer",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    textColor: (t) => yellow(t),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    headerTextColor: (t) => blue(t),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    footerTextColor: (t) => green(t),
    textAlignment: "right",
    padding: 1,
});
console.log(allCustomColorsBox); 