import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const writeConsoleLogBasedOnLevel = <L extends string = string>(level: LiteralUnion<ExtendedRfc5424LogLevels, L>): (...data: any[]) => void => {
    if (level === "error") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-console
        return (console as any).__error ?? console.error;
    }

    if (level === "warn") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-console
        return (console as any).__warn ?? console.warn;
    }

    if (level === "trace") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-console
        return (console as any).__trace ?? console.trace;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-console
    return (console as any).__log ?? console.log;
};

export default writeConsoleLogBasedOnLevel;
