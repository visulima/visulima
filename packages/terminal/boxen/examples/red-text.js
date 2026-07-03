import { boxen } from "@visulima/boxen";
import { red } from "@visulima/colorize";

console.log("\n----------- Box with a red text -----------");

console.log(boxen("Hello, world!", { textColor: (text) => red(text) }));
