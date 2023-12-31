import type { Rfc5424LogLevels } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writeConsoleLogBasedOnLevel = <L>(level: L | Rfc5424LogLevels): ((...data: any[]) => void) => {
    if (level === "error") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,no-console
        return (console as any).__error ?? console.error;
    }

    if (level === "warn") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,no-console
        return (console as any).__warn ?? console.warn;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,no-console
    return (console as any).__log ?? console.log;
};
