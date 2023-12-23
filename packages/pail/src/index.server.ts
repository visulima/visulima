import Pail from "./pail";
import PrettyReporter from "./reporter/pretty/pretty.server";
import type { ConstructorOptions, Rfc5424LogLevels } from "./types";

// eslint-disable-next-line import/exports-last
export * from "./shared";

// eslint-disable-next-line @typescript-eslint/naming-convention
const _getDefaultLogLevel = (): Rfc5424LogLevels => {
    if (process.env["NODE_ENV"] === "debug" || process.env["DEBUG"] !== undefined) {
        return "debug";
    }

    if (process.env["NODE_ENV"] === "test") {
        return "warning";
    }

    return "informational";
};

export const createPail = <T extends string = never, L extends string = never>(options?: ConstructorOptions<T, L>) =>
    new Pail<T, L>({
        logLevel: _getDefaultLogLevel(),
        reporters: options?.reporters ?? [new PrettyReporter()],
        stderr: process.stderr,
        stdout: process.stdout,
        ...options,
    });

export { default as callerProcessor } from "./processor/caller-processor";

export const pail = createPail();
