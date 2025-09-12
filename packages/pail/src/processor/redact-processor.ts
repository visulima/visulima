import type { RedactOptions, Rules } from "@visulima/redact";

import type { Meta, Processor } from "../types";

class RedactProcessor<L extends string = string> implements Processor<L> {
    readonly #redact: <T>(input: T) => T;

    public constructor(rules?: Rules, options?: RedactOptions) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require,unicorn/prefer-module
            const { redact, standardRules } = require("@visulima/redact");

            this.#redact = <T>(input: T) => redact(input, rules || standardRules, options);
        } catch {
            throw new Error("The '@visulima/redact' package is missing. Make sure to install the '@visulima/redact' package.");
        }
    }

    public process(meta: Meta<L>): Meta<L> {
        // eslint-disable-next-line no-param-reassign
        meta.message = this.#redact<typeof meta.message>(meta.message);
        // eslint-disable-next-line no-param-reassign
        meta.context = this.#redact<typeof meta.context>(meta.context);
        // eslint-disable-next-line no-param-reassign
        meta.error = this.#redact<typeof meta.error>(meta.error);

        return meta;
    }
}

export default RedactProcessor;
