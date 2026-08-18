import { describe, expect, it } from "vitest";

import { negatable } from "../../src/util/negatable-option";

describe(negatable, () => {
    it("should key the option and its negated twin by name", () => {
        expect.assertions(3);

        const pair = negatable({ defaultValue: true, description: "Enable caching", name: "cache", type: Boolean });

        expect(Object.keys(pair).sort()).toStrictEqual(["cache", "no-cache"]);
        expect(pair.cache).toStrictEqual({ defaultValue: true, description: "Enable caching", type: Boolean });
        expect(pair["no-cache"].type).toBe(Boolean);
    });

    it("should carry the positive option through without its name", () => {
        expect.assertions(2);

        // The record key is the name, so it must not also sit inside the value.
        const pair = negatable({ defaultValue: true, description: "Enable caching", name: "cache", type: Boolean });

        expect(pair.cache).not.toHaveProperty("name");
        expect(pair.cache.description).toBe("Enable caching");
    });

    it("should hide the twin so help output is unchanged", () => {
        expect.assertions(1);

        expect(negatable({ description: "x", name: "flaky", type: Boolean })["no-flaky"].hidden).toBe(true);
    });

    it("should give the twin no defaultValue so a tri-state option stays tri-state", () => {
        expect.assertions(1);

        // With a default on the twin, "neither flag passed" would resolve to
        // a boolean and clobber the "fall back to config" case.
        expect(negatable({ description: "x", name: "strict-env", type: Boolean })["no-strict-env"]).not.toHaveProperty("defaultValue");
    });
});
