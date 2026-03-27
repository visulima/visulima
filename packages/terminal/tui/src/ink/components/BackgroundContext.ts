import { createContext, type Context } from "react";
import type { LiteralUnion } from "type-fest";
// eslint-disable-next-line import/no-extraneous-dependencies
import { type AnsiColors } from "@visulima/colorize";

export type BackgroundColor = LiteralUnion<AnsiColors, string>;

export const backgroundContext: Context<BackgroundColor | undefined> = createContext<BackgroundColor | undefined>(undefined);
