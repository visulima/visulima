import type { FormatterFunction } from "@visulima/fmt";
import { build } from "@visulima/fmt";
import type { stringify } from "safe-stable-stringify";

import type { Meta, Serializer, StringifyAwareProcessor } from "../types";
import { getType } from "../util/get-type";

export class MessageFormatterProcessor<L extends string = never> implements StringifyAwareProcessor<L> {
    readonly #serializers: Map<string, Serializer>;

    #stringify: typeof stringify | undefined;

    readonly #formatters: Record<string, FormatterFunction> | undefined;

    public constructor(options: { formatters?: Record<string, FormatterFunction>; serializers?: Serializer[] } = {}) {
        this.#serializers = new Map((options.serializers ?? []).map((s) => [s.name, s]));
        this.#formatters = options.formatters;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.#stringify = function_;
    }

    public process(meta: Meta<L>): Meta<L> {
        const format = build({
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
                    console.warn(`Unable to stringify value of type ${getType(value)}`, value);

                    return "undefined";
                }

                return stringified;
            },
        });

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (getType(meta.message) === "Array" && (meta.message as [string, unknown[]]).length > 0) {
            const message = meta.message as [string, unknown[]];

            if (getType(message[0]) === "String") {
                // eslint-disable-next-line no-param-reassign
                meta.message = format(message[0], message.slice(1));
            }
        }

        return meta;
    }
}
