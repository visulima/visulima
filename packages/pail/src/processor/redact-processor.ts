import type { RedactOptions, Rules } from "@visulima/redact";
import { redact, standardRules } from "@visulima/redact";

import type { Meta, Processor } from "../types";

class RedactProcessor<L extends string = string> implements Processor<L> {
    readonly #redact: <T>(input: T) => T;

    public constructor(rules?: Rules, options?: RedactOptions) {
        this.#redact = <T>(input: T) => redact(input, rules || standardRules, options);
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
