import type { LiteralUnion } from "type-fest";

import type { Rfc5424LogLevels } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writeConsoleLogBasedOnLevel = <L extends string = never>(level: LiteralUnion<Rfc5424LogLevels, L>): ((...data: any[]) => void) => {
    if (level === "error") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-console
        return (console as any).__error ?? console.error;
    }

    if (level === "warn") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-console
        return (console as any).__warn ?? console.warn;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-console
    return (console as any).__log ?? console.log;
};
