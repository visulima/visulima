import ColorizeImpl from "./colorize.server";
import { makeColorizeTemplate } from "./template/make-colorize-template";
import { makeTemplate } from "./template/make-template";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

// eslint-disable-next-line import/no-unused-modules,@typescript-eslint/no-explicit-any
export const makeTaggedTemplate = (instance: ColorizeType): (firstString: TemplateStringsArray, ...arguments_: any[]) => string => makeColorizeTemplate(makeTemplate(instance));

// eslint-disable-next-line import/no-unused-modules
export const template = makeTemplate(colorize);

// eslint-disable-next-line import/no-default-export
export default makeColorizeTemplate(template);
