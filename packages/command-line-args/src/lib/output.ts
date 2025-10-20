import camelCase from "lodash.camelcase";

import Option from "./option.js";
import Definitions from "./option-definitions.js";

/**
 * A map of { DefinitionNameString: Option }. By default, an Output has an `_unknown` property and any options with defaultValues.
 */
class Output extends Map {
    definitions: Definitions;

    constructor(definitions: any[]) {
        super();
        /**
         * @type {OptionDefinitions}
         */
        this.definitions = Definitions.from(definitions);

        /* by default, an Output has an `_unknown` property and any options with defaultValues */
        this.set("_unknown", Option.create({ multiple: true, name: "_unknown" }));

        for (const def of this.definitions.whereDefaultValueSet()) {
            this.set(def.name, Option.create(def));
        }
    }

    toObject(options?: any): any {
        options = options || {};
        const output: any = {};

        for (const item of this) {
            const name = options.camelCase && item[0] !== "_unknown" ? camelCase(item[0]) : item[0];
            const option = item[1];

            if (name === "_unknown" && option.get().length === 0)
                continue;

            output[name] = option.get();
        }

        if (options.skipUnknown)
            delete output._unknown;

        return output;
    }
}

export default Output;
