import { bgRed, blue, green, yellow } from "@visulima/colorize";

import { boxen } from "../dist/index.mjs";

const text = "This text has a custom color!";

console.log("\n--- Custom Text Color (bgRed) ---");
const customColorBox = boxen(text, {
    headerText: "Custom Color (bgRed)",
    textColor: (t) => bgRed(t),
});

console.log(customColorBox);

console.log("\n--- Custom Header Text Color (blue) ---");
const customHeaderColorBox = boxen("Content with blue header", {
    headerText: "Blue Header",

    headerTextColor: (t) => blue(t),
});

console.log(customHeaderColorBox);

console.log("\n--- Custom Footer Text Color (green) ---");
const customFooterColorBox = boxen("Content with green footer", {
    footerText: "Green Footer",

    footerTextColor: (t) => green(t),
    textAlignment: "center",
});

console.log(customFooterColorBox);

console.log("\n--- All Custom Colors (yellow text, blue header, green footer) ---");
const allCustomColorsBox = boxen("Colorful content!", {
    footerText: "Colorful Footer",

    footerTextColor: (t) => green(t),
    headerText: "Colorful Header",

    headerTextColor: (t) => blue(t),
    padding: 1,
    textAlignment: "right",

    textColor: (t) => yellow(t),
});

console.log(allCustomColorsBox);
