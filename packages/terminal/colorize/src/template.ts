import ColorizeImpl from "./colorize.server";
import { makeColorizeTemplate } from "./template/make-colorize-template";
import { makeTemplate } from "./template/make-template";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

// eslint-disable-next-line import/exports-last
export const makeTaggedTemplate = (instance: ColorizeType): (firstString: TemplateStringsArray, ...arguments_: any[]) => string =>
    makeColorizeTemplate(makeTemplate(instance));

// eslint-disable-next-line import/exports-last
export const template: (string: string) => string = makeTemplate(colorize);

const templateFunction: (firstString: TemplateStringsArray, ...arguments_: any[]) => string = makeColorizeTemplate(template);

export default templateFunction;
