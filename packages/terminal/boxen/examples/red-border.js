import { boxen } from "@visulima/boxen";
import { red } from "@visulima/colorize";

console.log("\n----------- Box with a red boarder -----------");

console.log(boxen("Hello, world!", { borderColor: (border) => red(border) }));
