import { createContext, type Context } from "react";

export const accessibilityContext: Context<{ isScreenReaderEnabled: boolean }> = createContext<{ isScreenReaderEnabled: boolean }>({
    isScreenReaderEnabled: false,
});
