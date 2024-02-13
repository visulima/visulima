export const clone = <V>(value: V): V => {
    if (Array.isArray(value)) {
        const temporary = [];

        const value_length = value.length;
        let value_index = 0;

        while (value_index < value_length) {
            temporary.push(clone(value[value_index]));
            value_index++;
        }

        return temporary;
    }

    if (typeof value === "function") {
        return value.bind({});
    }

    if (value && typeof value === "object" && value.constructor === Object) {
        const temporary: Record<string, unknown> = {};

        const value_keys = Object.keys(value);
        const value_length = value_keys.length;

        let value_index = 0;

        while (value_index < value_length) {
            temporary[value_keys[value_index]] = clone((value as Record<string, unknown>)[value_keys[value_index]]);
            value_index++;
        }

        return temporary;
    }

    if (value && (value as Date).constructor === Date) {
        return new Date((value as Date).getTime());
    }

    if (value && typeof value === "object") {
        // Case of Date, RegExp, etc.
        return value.constructor(JSON.parse(JSON.stringify(value)));
    }

    return value;
};
