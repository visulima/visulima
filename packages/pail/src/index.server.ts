import Pail from "./pail";
import PrettyReporter from "./reporter/pretty/pretty.server";
import type { ConstructorOptions, DefaultLogLevels } from "./types";

export * from "./shared";

const _getDefaultLogLevel = (): DefaultLogLevels => {
    if (process.env["NODE_ENV"] === "debug") {
        return "debug";
    }

    if (process.env["NODE_ENV"] === "test") {
        return "warn";
    }

    return "info";
};

export const createPail = <T extends string = never, L extends string = never>(options?: ConstructorOptions<T, L>) =>
    new Pail<T, L>({
        logLevel: _getDefaultLogLevel(),
        reporters: options?.reporters || [new PrettyReporter()],
        stderr: process.stderr,
        stdout: process.stdout,
        ...options,
    });

export { default as fileProcessor } from "./processor/file-processor";

export const pail = createPail();
