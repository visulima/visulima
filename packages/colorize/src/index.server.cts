import ColorizeImpl from "./colorize.server";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

export default colorize as ColorizeType;

export const Colorize: new () => ColorizeType = ColorizeImpl;

export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
