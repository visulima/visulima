import ColorizeImpl from "./colorize.server";
import { makeColorizeTemplate } from "./template/make-colorize-template";
import { makeTemplate } from "./template/make-template";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeTaggedTemplate = (instance: ColorizeType): (firstString: TemplateStringsArray, ...arguments_: any[]) => string =>
    makeColorizeTemplate(makeTemplate(instance));

export const template = makeTemplate(colorize);

export default makeColorizeTemplate(template);
