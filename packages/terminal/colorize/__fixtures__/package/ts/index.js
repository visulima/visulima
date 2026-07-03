import colorize, { red, green, blue, yellow, magenta } from "@visulima/colorize";

const log = console.log;
const pink = colorize.hex("#FF75D1");

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
