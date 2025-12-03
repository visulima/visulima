import { describe, expect, it } from "vitest";

import CallerProcessor from "../../../../src/processor/caller/caller-processor";
import type { Meta } from "../../../../src/types";

const defaultMeta = {
    badge: undefined,
    context: undefined,
    date: new Date(),
    error: undefined,
    file: undefined,
    groups: [],
    label: undefined,
    message: undefined,
    prefix: undefined,
    repeated: undefined,
    scope: undefined,
    suffix: undefined,
    traceError: undefined,
    type: { level: "string", name: "string" },
};

describe("callerProcessor", () => {
    it("should add file information to meta object when file information is not present", () => {
        expect.assertions(1);

        const processor = new CallerProcessor();

        const result = processor.process({ ...defaultMeta } satisfies Meta<string>);

        expect(result.file).toStrictEqual({
            column: expect.any(Number),

            line: expect.any(Number),

            name: expect.any(String),
        });
    });
});
