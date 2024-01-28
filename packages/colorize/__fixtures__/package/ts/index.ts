import colorize, { Colorize, red, green, blue, yellow, magenta } from "@visulima/colorize";
import type { AnsiColors } from "@visulima/colorize";

const log = console.log;
const pink = colorize.hex("#FF75D1");

// create new instance
const colorize2 = new Colorize();
log(colorize2.cyan("new instance"));

// `AnsiColorsExtend` is an extendable type for TS to add a custom color
const write = (style: AnsiColors, message: string) => {
    console.log(colorize[style](message));
};

write("red", "message"); // default style OK
// write('unknown', 'message'); // TS Error

const boldText = colorize.bold.open + "text bold" + colorize.bold.close;
const styledText = magenta.underline.italic("underline italic magenta");
const str = "string";

log(boldText);
log(pink("pink"));
log(red("red"));
log(green.bold("green"));
log(blue.underline.italic("blue"));
log(yellow.italic(`yellow using ${str} variable`));
log(red.bgCyan.underline.hex("#fce")("text underline"));
log(styledText);
log(colorize.strip(styledText));
