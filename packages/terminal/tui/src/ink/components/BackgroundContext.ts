import { createContext, type Context } from "react";
import type { LiteralUnion } from "type-fest";
import { type ForegroundColorName } from "ansi-styles";

export type BackgroundColor = LiteralUnion<ForegroundColorName, string>;

export const backgroundContext: Context<BackgroundColor | undefined> = createContext<BackgroundColor | undefined>(undefined);
