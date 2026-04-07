/* eslint-disable unicorn/filename-case */
import type { Context } from "react";
import { createContext } from "react";

export const accessibilityContext: Context<{ isScreenReaderEnabled: boolean }> = createContext<{ isScreenReaderEnabled: boolean }>({
    isScreenReaderEnabled: false,
});
