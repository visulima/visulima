import { boxen } from "@visulima/boxen";
import {red, green, yellow, blue} from "@visulima/colorize";

console.log("\n----------- Box with a red text -----------");

console.log(boxen(red("Hello, world!")));

console.log("\n----------- Box with a red boarder -----------");

console.log(boxen("Hello, world!", { borderColor: (border) => red(border) }));

console.log("\n----------- Box with a multi color boarder -----------");

console.log(
    boxen("Hello, world!", {
        borderColor: (border, position) => {
            if (position === "top") {
                return red(border);
            }

            if (position === "left") {
                return yellow(border);
            }

            if (position === "right") {
                return green(border);
            }

            if (position === "bottom") {
                return blue(border);
            }
        },
    }),
);

console.log("\n----------- Box with a multi color boarder and title -----------");

console.log(
    boxen("Hello, world!", {
        headerText: "Multi Color",
        borderColor: (border, position) => {
            if (position === "top") {
                return red(border);
            }

            if (position === "left") {
                return yellow(border);
            }

            if (position === "right") {
                return green(border);
            }

            if (position === "bottom") {
                return blue(border);
            }
        },
    }),
);

console.log("\n----------- Box with a multi color boarder with header and footer text -----------");

console.log(
    boxen("This is a long this", {
        headerText: "Header Text",
        footerText: "Footer Text",
        borderColor: (border, position) => {
            if (position === "top") {
                return red(border);
            }

            if (position === "left") {
                return yellow(border);
            }

            if (position === "right") {
                return green(border);
            }

            if (position === "bottom") {
                return blue(border);
            }
        },
    }),
);
