const colorize = require("@visulima/colorize");

console.log(colorize);

const { Colorize, red, green, hex } = require("@visulima/colorize");

const log = console.log;

log(colorize.ansi256(227).inverse(" -= [colorize package] CommonJS =- "));

// styles
log(red.bold.underline(`red.bold.underline('red')`));
log(colorize.red.bold.underline(`colorize.red.bold.underline(red)`));

log(hex("#faff63").bold(`hex('#FFAB40').bold('#63ffc6')`));
log(colorize.hex("#faff63").bold(`colorize.hex('#FFAB40').bold(#63ffc6)`));

const colorize2 = new Colorize();

log(colorize2.bold.red("colorize2.bold.red"));

// strip
const greenText = green`green text`;

log("colored: ", greenText);
log("striped: ", colorize.strip(greenText));
