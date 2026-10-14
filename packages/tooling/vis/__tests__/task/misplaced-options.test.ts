import { describe, expect, it } from "vitest";

import { describeMisplacedTargetKeys, findMisplacedTargetKeys } from "../../src/task/misplaced-options";

describe(findMisplacedTargetKeys, () => {
    it("finds target properties written under options, sorted", () => {
        expect.assertions(1);

        expect(findMisplacedTargetKeys({ hashMode: "trace", persistent: true, splitCompound: true })).toStrictEqual(["hashMode", "splitCompound"]);
    });

    it("leaves real options alone", () => {
        expect.assertions(1);

        expect(findMisplacedTargetKeys({ envFile: ".env", persistent: true, pty: false, strictEnv: true })).toStrictEqual([]);
    });

    it("tolerates a missing or null options bag", () => {
        expect.assertions(2);

        expect(findMisplacedTargetKeys(undefined)).toStrictEqual([]);
        expect(findMisplacedTargetKeys(null as never)).toStrictEqual([]);
    });
});

describe(describeMisplacedTargetKeys, () => {
    it("names the keys and says where they belong", () => {
        expect.assertions(2);

        expect(describeMisplacedTargetKeys("app:build", ["splitCompound"])).toBe(
            "app:build: \"splitCompound\" is a target property, not an option, so it is ignored under \"options\". Move it next to \"command\".",
        );
        expect(describeMisplacedTargetKeys("app:build", ["cache", "hashMode"])).toContain("are target properties, not options");
    });
});
