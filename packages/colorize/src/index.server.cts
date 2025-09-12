import ColorizeImpl from "./colorize.server";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

export default colorize as ColorizeType;

// eslint-disable-next-line unicorn/prefer-export-from
export const Colorize = ColorizeImpl;

export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
