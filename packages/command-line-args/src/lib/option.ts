import arrayify from "array-back";
import t from "typical";

import Definition from "./option-definition.js";

const _value = new WeakMap();

/**
 * Encapsulates behaviour (defined by an OptionDefinition) when setting values
 */
class Option {
    private definition: any;

    state: string | null;

    constructor(definition: any) {
        this.definition = new Definition(definition);
        this.state = null; /* set or default */
        this.resetToDefault();
    }

    get(): any {
        return _value.get(this);
    }

    set(value: any): void {
        this._set(value, "set");
    }

    _set(value: any, state: string): void {
        const def = this.definition;

        if (def.isMultiple()) {
            /* don't add null or undefined to a multiple */
            if (value !== null && value !== undefined) {
                const array = this.get();

                if (this.state === "default")
                    array.length = 0;

                array.push(def.type(value));
                this.state = state;
            }
        } else {
            /* throw if already set on a singlar defaultOption */
            if (!def.isMultiple() && this.state === "set") {
                const error = new Error(`Singular option already set [${this.definition.name}=${this.get()}]`);

                error.name = "ALREADY_SET";
                error.value = value;
                error.optionName = def.name;
                throw error;
            } else if (value === null || value === undefined) {
                _value.set(this, value);
                // /* required to make 'partial: defaultOption with value equal to defaultValue 2' pass */
                // if (!(def.defaultOption && !def.isMultiple())) {
                //   this.state = state
                // }
            } else {
                _value.set(this, def.type(value));
                this.state = state;
            }
        }
    }

    resetToDefault(): void {
        if (t.isDefined(this.definition.defaultValue)) {
            if (this.definition.isMultiple()) {
                _value.set(this, [...arrayify(this.definition.defaultValue)]);
            } else {
                _value.set(this, this.definition.defaultValue);
            }
        } else if (this.definition.isMultiple()) {
            _value.set(this, []);
        } else {
            _value.set(this, null);
        }

        this.state = "default";
    }

    static create(definition: any): Option | FlagOption {
        definition = new Definition(definition);

        if (definition.isBoolean()) {
            return FlagOption.create(definition);
        }

        return new this(definition);
    }
}

class FlagOption extends Option {
    set(value: any): void {
        super.set(true);
    }

    static create(def: any): FlagOption {
        return new this(def);
    }
}

export default Option;
