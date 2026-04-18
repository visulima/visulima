import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels } from "../types";

const writeConsoleLogBasedOnLevel = <L extends string = string>(level: LiteralUnion<ExtendedRfc5424LogLevels, L>): ((...data: any[]) => void) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = console as Record<string, any>;

    if (level === "error") {
        // eslint-disable-next-line no-console, no-underscore-dangle, @typescript-eslint/no-unsafe-return
        return c.__error ?? console.error;
    }

    if (level === "warn") {
        // eslint-disable-next-line no-console, no-underscore-dangle, @typescript-eslint/no-unsafe-return
        return c.__warn ?? console.warn;
    }

    if (level === "trace") {
        // eslint-disable-next-line no-console, no-underscore-dangle, @typescript-eslint/no-unsafe-return
        return c.__trace ?? console.trace;
    }

    // eslint-disable-next-line no-console, no-underscore-dangle, @typescript-eslint/no-unsafe-return
    return c.__log ?? console.log;
};

export default writeConsoleLogBasedOnLevel;
