import arrayify from "array-back";
import camelCase from "lodash.camelcase";
import t from "typical";

import Output from "./output";

class GroupedOutput extends Output {
    toObject(options: any): any {
        const superOutputNoCamel = super.toObject({ skipUnknown: options.skipUnknown });
        const superOutput = super.toObject(options);
        const unknown = superOutput._unknown;

        delete superOutput._unknown;
        const grouped: any = {
            _all: superOutput,
        };

        if (unknown && unknown.length > 0)
            grouped._unknown = unknown;

        this.definitions.whereGrouped().forEach((def: any) => {
            const name = options.camelCase ? camelCase(def.name) : def.name;
            const outputValue = superOutputNoCamel[def.name];

            for (const groupName of arrayify(def.group)) {
                grouped[groupName] = grouped[groupName] || {};

                if (t.isDefined(outputValue)) {
                    grouped[groupName][name] = outputValue;
                }
            }
        });

        this.definitions.whereNotGrouped().forEach((def: any) => {
            const name = options.camelCase ? camelCase(def.name) : def.name;
            const outputValue = superOutputNoCamel[def.name];

            if (t.isDefined(outputValue)) {
                if (!grouped._none)
                    grouped._none = {};

                grouped._none[name] = outputValue;
            }
        });

        return grouped;
    }
}

export default GroupedOutput;
