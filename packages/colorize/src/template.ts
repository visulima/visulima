import ColorizeImpl from "./colorize.server";
import type { ColorizeType } from "./types";
import { makeTemplate } from "./template/make-template";
import { makeColorizeTemplate } from "./template/make-colorize-template";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

export const makeTaggedTemplate = (instance: ColorizeType): (firstString: TemplateStringsArray, ...arguments_: any[]) => string => makeColorizeTemplate(makeTemplate(instance));

export const template = makeTemplate(colorize);

// eslint-disable-next-line import/no-default-export
export default makeColorizeTemplate(template);
