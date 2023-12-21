import type { DefaultLogLevels } from "../types";

const writeConsoleLogBasedOnLevel = <L>(level: DefaultLogLevels | L): ((...data: any[]) => void) => {
    if (level === "error") {
        return (console as any).__error ?? console.error;
    }

    if (level === "warn") {
        return (console as any).__warn ?? console.warn;
    }

    return (console as any).__log ?? console.log;
};

export default writeConsoleLogBasedOnLevel;
