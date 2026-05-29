import { describe, expect, it } from "vitest";

import { inspect } from "../../src";
import type { InternalInspect, Options } from "../../src/types";
import inspectProperty from "../../src/utils/inspect-property";

const createOptions = (overrides: Partial<Options> = {}): Options => {
    return {
        breakLength: Number.POSITIVE_INFINITY,
        customInspect: true,
        depth: 5,
        indent: undefined,
        maxArrayLength: Number.POSITIVE_INFINITY,
        numericSeparator: true,
        quoteStyle: "single",
        showHidden: false,
        showProxy: false,
        stylize: (s: string) => s,
        truncate: Number.POSITIVE_INFINITY,
        ...overrides,
    };
};

const internalInspect: InternalInspect = (value: unknown, _from: unknown, options: Options): string => inspect(value, options);

describe("inspectProperty", () => {
    it("renders a string key, quoting complex keys", () => {
        expect.assertions(2);

        expect(inspectProperty(["foo", 1], {}, createOptions(), internalInspect)).toBe("foo: 1");
        expect(inspectProperty(["a-b", 1], {}, createOptions(), internalInspect)).toBe("'a-b': 1");
    });

    it("renders a numeric key without quotes", () => {
        expect.assertions(1);

        // Number keys do not arrive through the public `inspect` API (object keys are
        // always strings/symbols), but `inspectProperty` supports them directly.
        expect(inspectProperty([5, "v"], {}, createOptions(), internalInspect)).toBe("5: 'v'");
    });

    it("renders a symbol key wrapped in brackets", () => {
        expect.assertions(1);

        expect(inspectProperty([Symbol("s"), 1], {}, createOptions(), internalInspect)).toBe("[Symbol(s)]: 1");
    });
});
