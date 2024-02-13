"use strict";

import { red, green, cyan, magenta, yellow, italic, underline } from "@visulima/colorize";

console.log(red(`red ${italic(`red italic ${underline(`red italic underline`)}`)} red`));

// deep nested chained styles
console.log(green(`green ${yellow(`yellow ${magenta(`magenta ${cyan(`cyan ${red.italic.underline`red italic underline`} cyan`)} magenta`)} yellow`)} green`));
