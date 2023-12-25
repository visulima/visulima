import { describe, expect, it } from "vitest";

import callerProcessor from "../../src/processor/caller-processor";

const defaultMeta = {
    badge: undefined,
    context: undefined,
    date: new Date(),
    error: undefined,
    file: undefined,
    label: undefined,
    message: undefined,
    prefix: undefined,
    repeated: undefined,
    scope: undefined,
    suffix: undefined,
    type: undefined,
};

describe("callerProcessor", () => {
    it("should add file information to meta object when file information is not present", () => {
        const result = callerProcessor<string>({ ...defaultMeta });

        expect(result.file).toStrictEqual({
            column: expect.any(Number),
            line: expect.any(Number),
            name: expect.any(String),
        });
    });
});
