import { boxen } from "@visulima/boxen";
import colorize from "@visulima/colorize";
import { GradientBuilder } from "@visulima/colorize/gradient";

console.log("\n----------- Box with gradient boarder, padding, header and footer text -----------");

const forbiddenChars = /\s/g;
const builder = new GradientBuilder(colorize, ["#ff0000", "#ff0100"]);

let colors;

const headerText = "Header Text";
const footerText = "Footer Text";

console.log(
    boxen("This is a long this", {
        headerText,
        footerText,
        padding: 1,
        borderColor: (border, position, length) => {
            if ("top" === position || "bottom" === position) {
                const textLength = headerText.replaceAll(forbiddenChars, "").length;

                const colorsCount = Math.max(length + textLength, builder.stops.length);

                colors = builder.hsv(colorsCount, "long");

                let result = "";
                // NOTE: This need to be adjusted based on the text alignment
                let colorsCountIndex = position === "top" ? textLength : 0;

                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const s of border) {
                    if (forbiddenChars.test(s)) {
                        result += s;
                    } else {
                        const color = colors[colorsCountIndex++];

                        result += color(s);
                    }
                }

                return result;
            }

            if (position === "topLeft" || position === "left" || position === "bottomLeft") {
                return colors[0](border);
            }

            if (position === "topRight" || position === "right" || position === "bottomRight") {
                return colors[colors.length - 1](border);
            }

            return border;
        },
    }),
);
