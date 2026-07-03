// Compile-only fixture. Imports the published surface of @visulima/colorize
// and exercises its public types so a broken dist/*.d.ts will fail `tsc --noEmit`.
import colorize, { blue, Colorize, green, magenta, red } from "@visulima/colorize";
import type { AnsiColors } from "@visulima/colorize";

const instance = new Colorize();
const styled: string = colorize.red.bold("hi");
const stripped: string = colorize.strip("[31mhi[39m");

const colored: string = red("error");
const more: string = blue.underline.italic(green("nested"));
const wide: string = magenta("magenta");

const palette: AnsiColors = "yellow";

export { colored, instance, magenta, more, palette, styled, stripped, wide };
