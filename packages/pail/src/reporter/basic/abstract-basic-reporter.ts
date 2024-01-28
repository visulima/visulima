import type { stringify } from "safe-stable-stringify";

import type { ReadonlyMeta, Rfc5424LogLevels, StringifyAwareReporter } from "../../types";

export abstract class AbstractBasicReporter<L extends string = never> implements StringifyAwareReporter<L> {
    protected _stringify: typeof stringify | undefined;

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this._stringify = function_;
    }

    // eslint-disable-next-line sonarjs/cognitive-complexity
    public log(meta: ReadonlyMeta<L>): void {
        const { type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        let logMessage = "";

        if (rest.date) {
            logMessage += `${rest.date.toString()} `;
        }

        if (rest.badge) {
            logMessage += `${rest.badge} `;
        }

        if (rest.label) {
            logMessage += `${rest.label}: `;
        }

        if (rest.repeated) {
            logMessage += ` [${rest.repeated}x]`;
        }

        if (rest.scope && rest.scope.length > 0) {
            logMessage += `[${rest.scope.join(" | ")}] `;
        }

        if (rest.prefix) {
            logMessage += `${rest.prefix} `;
        }

        if (rest.file) {
            logMessage += `${rest.file.name}:${rest.file.line}${rest.file.column ? `:${rest.file.column}` : ""}`;
        }

        if (rest.message) {
            logMessage += `${rest.message as string}`;

            if (rest.context) {
                logMessage += `\n${(this._stringify as typeof stringify)(rest.context)}`;
            }
        }

        if (rest.error) {
            logMessage += `\n${(this._stringify as typeof stringify)(rest.context)}`;
        }

        if (rest.suffix) {
            logMessage += ` ${rest.suffix}`;
        }

        this._log(logMessage, type.level);
    }

    protected abstract _log(message: string, logLevel: L | Rfc5424LogLevels): void;
}
