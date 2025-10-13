import type { format, FormatterFunction, Options } from "@visulima/fmt";
import { build } from "@visulima/fmt";
import type { stringify } from "safe-stable-stringify";

import type { Meta, StringifyAwareProcessor } from "../types";

class MessageFormatterProcessor<L extends string = string> implements StringifyAwareProcessor<L> {
    #stringify: typeof stringify | undefined;

    readonly #formatters: Record<string, FormatterFunction> | undefined;

    public constructor(options: { formatters?: Record<string, FormatterFunction> } = {}) {
        this.#formatters = options.formatters;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this.#stringify = function_;
    }

    public process(meta: Meta<L>): Meta<L> {
        const formatter = build({
            formatters: this.#formatters,
            stringify: (value: unknown) => {
                const stringified = (this.#stringify as typeof stringify)(value);

                if (stringified === undefined) {
                    // eslint-disable-next-line no-console
                    console.warn(`Unable to stringify value of type ${typeof value}`, value);

                    return "undefined";
                }

                return stringified;
            },
        } as Options);

        if (meta.message !== undefined) {
            // eslint-disable-next-line no-param-reassign
            meta.message = this._format(formatter, meta.message, meta.context ?? []);
        }

        return meta;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _format(formatter: typeof format, data: any, arguments_: unknown[] = []): any {
        if (typeof data === "string") {
            return formatter(data as string, arguments_);
        }

        if (typeof data === "object" && data !== null) {
            // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
            for (const index in data as Record<string, unknown> | [string, unknown[]]) {
                // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-explicit-any
                const value = (data as any)[index];

                if (typeof value === "string" || Array.isArray(value) || typeof value === "object") {
                    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
                    data[index] = this._format(formatter, value, arguments_);
                }
            }
        }

        return data;
    }
}

export default MessageFormatterProcessor;
