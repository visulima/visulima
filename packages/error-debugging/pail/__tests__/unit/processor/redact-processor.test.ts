import { compromiseScanner } from "@visulima/redact/nlp";
import { describe, expect, it } from "vitest";

import RedactProcessor from "../../../src/processor/redact-processor";
import type { Meta } from "../../../src/types";

const SENSITIVE_PATTERN = /sensitive/;

describe("redactProcessor", () => {
    it("should use default standardRules when no rules are provided and redact sensitive information in meta.message", () => {
        expect.assertions(1);

        const processor = new RedactProcessor();
        const meta = { message: "John Doe will be 30 on 2024-06-10" } as Meta<string>;
        const result = processor.process(meta);

        // The date is a pattern rule, so it is masked by default. A person's name has no regex
        // shape: @visulima/redact finds it only when an `nlp` scanner is supplied, which the
        // processor does not do on its own — see the opt-in test below.
        expect(result.message).toBe("John Doe will be 30 on <DATE>");
    });

    it("should redact names in meta.message when an nlp scanner is supplied", () => {
        expect.assertions(1);

        // Proves the processor forwards `options` to redact, which is the whole opt-in path
        // for consumers who install `compromise` and want prose entity detection back.
        const processor = new RedactProcessor(undefined, { nlp: compromiseScanner });
        const meta = { message: "John Doe will be 30 on 2024-06-10" } as Meta<string>;
        const result = processor.process(meta);

        expect(result.message).toBe("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
    });

    it("should redact sensitive information in meta.context", () => {
        expect.assertions(1);

        const processor = new RedactProcessor();
        const meta = { context: ["John Doe will be 30 on 2024-06-10"] } as Meta<string>;

        const result = processor.process(meta);

        expect(result.context).toStrictEqual(["John Doe will be 30 on <DATE>"]);
    });

    it("should redact sensitive information in meta.context with an nlp scanner", () => {
        expect.assertions(1);

        const processor = new RedactProcessor(undefined, { nlp: compromiseScanner });
        const meta = { context: ["John Doe will be 30 on 2024-06-10"] } as Meta<string>;

        const result = processor.process(meta);

        expect(result.context).toStrictEqual(["<FIRSTNAME> <LASTNAME> will be 30 on <DATE>"]);
    });

    // @TODO: Enable test if @visulima/redact supports Error message redaction
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip("should redact sensitive information in meta.error", () => {
        expect.assertions(1);

        const processor = new RedactProcessor(undefined, { nlp: compromiseScanner });
        const meta = { error: new Error("John Doe will be 30 on 2024-06-10") } as Meta<string>;
        const result = processor.process(meta);

        expect(result.error?.message).toBe("<FIRSTNAME> <LASTNAME> will be 30 on <DATE>");
    });

    it("should use provided rules and options for redaction", () => {
        expect.assertions(1);

        const rules = [{ key: "redact", pattern: SENSITIVE_PATTERN, replacement: "[REDACTED]" }];

        const processor = new RedactProcessor(rules, { exclude: [] });
        const meta = { message: "Sensitive data" } as Meta<string>;
        const result = processor.process(meta);

        // The rule supplies an explicit `replacement`, which @visulima/redact now
        // honors for RegExp patterns (a non-global user RegExp previously hung the
        // anonymizer, masking the bug behind the default `<REDACT>` numbered mask).
        expect(result.message).toBe("[REDACTED] data");
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
