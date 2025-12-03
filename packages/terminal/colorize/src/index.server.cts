import ColorizeImpl from "./colorize.server";
import type { ColorizeType } from "./types";

type ColorizeTypeWithColorize = ColorizeType & { Colorize: typeof ColorizeImpl };

const colorize: ColorizeTypeWithColorize = new ColorizeImpl() as ColorizeTypeWithColorize;

colorize.Colorize = ColorizeImpl;

export default colorize as ColorizeTypeWithColorize;

export type { AnsiColors, AnsiStyles, ColorizeType } from "./types";
