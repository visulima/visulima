"use strict";

import { multilineGradient, gradient } from "@visulima/colorize/gradient";

// Use the same gradient on every line
let duck = multilineGradient(["orange", "yellow"])(["     __", "   <(o )___", "    ( ._> /", "     `---'"].join("\n"));

console.log(duck);
console.log(gradient(["blue", "cyan", "blue"])("----------------"));

console.log("");

// Works with advanced options
console.log(multilineGradient(["cyan", "pink"])("Multi line\nstring", { interpolation: "hsv" }));
