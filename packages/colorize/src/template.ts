import ColorizeImpl from "./colorize.server";
import { makeColorizeTemplate } from "./template/make-colorize-template";
import { makeTemplate } from "./template/make-template";
import type { ColorizeType } from "./types";

const colorize: ColorizeType = new ColorizeImpl() as ColorizeType;

export const makeTaggedTemplate = (instance: ColorizeType): (firstString: TemplateStringsArray, ...arguments_: any[]) => string =>
    makeColorizeTemplate(makeTemplate(instance));

export const template: (string: string) => string = makeTemplate(colorize);

const _default: (firstString: TemplateStringsArray, ...arguments_: any[]) => string = makeColorizeTemplate(template);
export default _default;
