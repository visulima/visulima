import { boxen } from "@visulima/boxen";
import { bgRed } from "@visulima/colorize";

console.log("\n----------- Red Box -----------");

console.log(boxen("Hello, world!", { textColor: (text) => bgRed.white(text), borderColor: (border) => bgRed.white(border) }));
