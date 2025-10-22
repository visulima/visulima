import { describe, expect, it } from "vitest";

import RedactProcessor from "../../../src/processor/redact-processor";
import type { Meta } from "../../../src/types";

describe("redactProcessor", () => {
    it("should use default standardRules when no rules are provided and redact sensitive information in meta.message", () => {
        expect.assertions(1);

        const processor = new RedactProcessor();
        const meta = { message: "John Doe will be 30 on 2024-06-10" } as Meta<string>;
        const result = processor.process(meta);

        expect(result.message).toBe("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
    });

    it("should redact sensitive information in meta.context", () => {
        expect.assertions(1);

        const processor = new RedactProcessor();
        const meta = { context: ["John Doe will be 30 on 2024-06-10"] } as Meta<string>;

        const result = processor.process(meta);

        expect(result.context).toStrictEqual(["<FIRSTNAME> <LASTNAME> will be 30 on <DATE>"]);
    });

    // @TODO: Enable test if @visulima/redact supports Error message redaction
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip("should redact sensitive information in meta.error", () => {
        expect.assertions(1);

        const processor = new RedactProcessor();
        const meta = { error: new Error("John Doe will be 30 on 2024-06-10") } as Meta<string>;
        const result = processor.process(meta);

        expect(result.error?.message).toBe("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
    });

    it("should use provided rules and options for redaction", () => {
        expect.assertions(1);

        const rules = [{ key: "redact", pattern: /sensitive/, replacement: "[REDACTED]" }];

        const processor = new RedactProcessor(rules, { exclude: [] });
        const meta = { message: "Sensitive data" } as Meta<string>;
        const result = processor.process(meta);

        expect(result.message).toBe("<REDACT> data");
    });

    it("should handle undefined values in meta fields", () => {
        expect.assertions(3);

        const processor = new RedactProcessor();

        let meta = { message: undefined } as Meta<string>;
        let result = processor.process(meta);

        expect(result.message).toBeUndefined();

        meta = { context: undefined } as Meta<string>;
        result = processor.process(meta);

        expect(result.context).toBeUndefined();

        meta = { error: undefined } as Meta<string>;
        result = processor.process(meta);

        expect(result.error).toBeUndefined();
    });
});
