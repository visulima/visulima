import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels } from "../types";

// Pail levels are RFC 5424 *names* (`warning`, `critical`, `alert`, `emergency`, ...),
// not the short console aliases. Map the high-severity names to `console.error` and
// `warning` to `console.warn` so browser output lands on the right console channel.
const ERROR_LEVELS = new Set<string>(["alert", "critical", "emergency", "error"]);

const writeConsoleLogBasedOnLevel = <L extends string = string>(level: LiteralUnion<ExtendedRfc5424LogLevels, L>): (...data: any[]) => void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = console as Record<string, any>;

    if (ERROR_LEVELS.has(level as string)) {
        // eslint-disable-next-line no-console, no-underscore-dangle, @typescript-eslint/no-unsafe-return
        return c.__error ?? console.error;
    }

    if (level === "warning") {
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
