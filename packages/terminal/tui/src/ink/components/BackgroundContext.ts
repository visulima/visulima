import type { AnsiColors } from "@visulima/colorize";
import type { Context } from "react";
import { createContext } from "react";
import type { LiteralUnion } from "type-fest";

export type BackgroundColor = LiteralUnion<AnsiColors, string>;

export const backgroundContext: Context<BackgroundColor | undefined> = createContext<BackgroundColor | undefined>(undefined);
