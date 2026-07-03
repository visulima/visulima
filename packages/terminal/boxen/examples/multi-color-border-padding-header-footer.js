import { boxen } from "@visulima/boxen";
import { red, green, yellow, blue } from "@visulima/colorize";

console.log("\n----------- Box with a multi color boarder, padding, header and footer text -----------");

console.log(
    boxen("This is a long this", {
        headerText: "Header Text",
        footerText: "Footer Text",
        padding: 1,
        borderColor: (border, position) => {
            if (["top", "topLeft", "topRight"].includes(position)) {
                return red(border);
            }

            if (position === "left") {
                return yellow(border);
            }

            if (position === "right") {
                return green(border);
            }

            if (["bottom", "bottomLeft", "bottomRight"].includes(position)) {
                return blue(border);
            }
        },
    }),
);
