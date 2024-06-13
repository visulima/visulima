import type { RedactOptions, Rules } from "@visulima/redact";
// eslint-disable-next-line import/no-extraneous-dependencies
import { redact, standardRules } from "@visulima/redact";

import type { Meta, Processor } from "../types";

class RedactProcessor<L extends string = string> implements Processor<L> {
    readonly #rules: Rules;

    readonly #options: RedactOptions;

    public constructor(rules: Rules = standardRules, options: RedactOptions = {}) {
        this.#rules = rules;
        this.#options = options;
    }

    public process(meta: Meta<L>): Meta<L> {
        // eslint-disable-next-line no-param-reassign
        meta.message = redact(meta.message, this.#rules, this.#options);
        // eslint-disable-next-line no-param-reassign
        meta.context = redact(meta.context, this.#rules, this.#options);
        // eslint-disable-next-line no-param-reassign
        meta.error = redact(meta.error, this.#rules, this.#options);

        return meta;
    }
}

export default RedactProcessor;
