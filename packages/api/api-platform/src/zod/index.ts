import { withGetType } from "zod-to-ts";

import { ZodDateIn } from "./date-in-schema";
import { ZodDateOut } from "./date-out-schema";

export const dateIn = (...parameters: Parameters<typeof ZodDateIn.create>): ReturnType<typeof withGetType<ZodDateIn>> =>
    withGetType(ZodDateIn.create(...parameters), (ts) => ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword));

export const dateOut = (...parameters: Parameters<typeof ZodDateOut.create>): ReturnType<typeof withGetType<ZodDateOut>> =>
    withGetType(ZodDateOut.create(...parameters), (ts) => ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword));
