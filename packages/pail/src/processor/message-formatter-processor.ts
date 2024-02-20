import type { format, FormatterFunction } from "@visulima/fmt";
import { build } from "@visulima/fmt";
import type { stringify } from "safe-stable-stringify";

import type { Meta, Serializer, StringifyAwareProcessor } from "../types";

export class MessageFormatterProcessor<L extends string = string> implements StringifyAwareProcessor<L> {
    readonly #serializers: Map<string, Serializer>;

    #stringify: typeof stringify | undefined;

    readonly #formatters: Record<string, FormatterFunction> | undefined;

    public constructor(options: { formatters?: Record<string, FormatterFunction>; serializers?: Serializer[] } = {}) {
        this.#serializers = new Map((options.serializers ?? []).map((s) => [s.name, s]));
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
                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,@typescript-eslint/naming-convention,@typescript-eslint/no-unused-vars
                for (const [_, serializer] of this.#serializers) {
                    if (serializer.isApplicable(value)) {
                        return serializer.serialize(value);
                    }
                }

                const stringified = (this.#stringify as typeof stringify)(value);

                if (stringified === undefined) {
                    // eslint-disable-next-line no-console
                    console.warn("Unable to stringify value of type " + typeof value, value);

                    return "undefined";
                }

                return stringified;
            },
        });

        if (meta.message !== undefined && Array.isArray(meta.context)) {
            // eslint-disable-next-line no-param-reassign
            meta.message = this._format(formatter, meta.message, meta.context);
            meta.context = [];
        }

        return meta;
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-explicit-any
    private _format(formatter: typeof format, data: any, argsuments_: any[]): any {
        if (typeof data === "string") {
            // eslint-disable-next-line no-param-reassign
            data = formatter(data as string, argsuments_);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        } else if (Array.isArray(data) && (data as [string, unknown[]]).length > 0) {
            // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
            for (const index in data as [string, unknown[]]) {
                // eslint-disable-next-line security/detect-object-injection
                const value = (data as [string, unknown[]])[index];

                if (typeof value === "string") {
                    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
                    data[index] = formatter(value);
                }
            }
        } else if (typeof data === "object" && data !== null) {
            // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
            for (const key in data as Record<string, unknown>) {
                // eslint-disable-next-line security/detect-object-injection
                const value = (data as Record<string, unknown>)[key];

                if (typeof value === "string") {
                    // eslint-disable-next-line no-param-reassign,security/detect-object-injection
                    data[key] = formatter(value);
                }
            }
        }

        return data;
    }
}
