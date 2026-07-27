import { describe, expect, it } from "vitest";

import { negatable } from "../../src/util/negatable-option";

describe(negatable, () => {
    it("should return the option followed by its negated twin", () => {
        expect.assertions(3);

        const [positive, negated] = negatable({ defaultValue: true, description: "Enable caching", name: "cache", type: Boolean });

        expect(positive?.name).toBe("cache");
        expect(negated?.name).toBe("no-cache");
        expect(negated?.type).toBe(Boolean);
    });

    it("should pass the positive option through untouched", () => {
        expect.assertions(1);

        const option = { defaultValue: true, description: "Enable caching", name: "cache", type: Boolean };

        expect(negatable(option)[0]).toBe(option);
    });

    it("should hide the twin so help output is unchanged", () => {
        expect.assertions(1);

        expect(negatable({ description: "x", name: "flaky", type: Boolean })[1]?.hidden).toBe(true);
    });

    it("should give the twin no defaultValue so a tri-state option stays tri-state", () => {
        expect.assertions(1);

        // With a default on the twin, "neither flag passed" would resolve to
        // a boolean and clobber the "fall back to config" case.
        expect(negatable({ description: "x", name: "strict-env", type: Boolean })[1]).not.toHaveProperty("defaultValue");
    });
});
