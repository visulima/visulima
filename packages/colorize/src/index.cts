import ColorizeImpl from "./colorize";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

// eslint-disable-next-line import/no-default-export,import/no-unused-modules
export default colorize as ColorizeType;

// eslint-disable-next-line unicorn/prefer-export-from,import/no-unused-modules
export const Colorize = ColorizeImpl;

// eslint-disable-next-line import/no-unused-modules
export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
