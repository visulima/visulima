import nlp from "compromise";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redact } from "../../src";

// Spy on the compromise default export while keeping its real behaviour, so we can assert how
// many times the (expensive) NLP parse runs. The single-pass filter evaluates ALL rules against
// each string in one stringAnonymize call, so compromise must be parsed exactly ONCE per string
// regardless of how many NLP-backed rules are supplied.
// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock("compromise", async () => {
    const actual = await vi.importActual<typeof import("compromise")>("compromise");

    return {
        ...actual,
        default: vi.fn<typeof nlp>((...arguments_) => actual.default(...arguments_)),
    };
});

const nlpMock = vi.mocked(nlp);

describe("compromise is parsed once per string", () => {
    beforeEach(() => {
        nlpMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("parses a single string exactly once even with multiple NLP-backed rules", () => {
        expect.assertions(2);

        const input = "John Doe works at Google and emailed jane@example.com about $500.";

        // Five NLP-backed rules covering different extractors — pre-refactor this re-parsed
        // the same string once per rule.
        const result = redact(input, ["firstname", "lastname", "organization", "email", "money"]);

        expect(nlpMock).toHaveBeenCalledTimes(1);
        expect(result).toBe("<FIRSTNAME> <LASTNAME> works at <ORGANIZATION> and emailed <EMAIL> about <MONEY>.");
    });

    it("parses each distinct string in an object exactly once regardless of rule count", () => {
        expect.assertions(1);

        const input = {
            a: "Alice Smith joined Acme.",
            b: "Bob Jones called from 555-123-4567.",
            c: "Carol works at Microsoft.",
        };

        redact(input, ["firstname", "lastname", "organization", "phonenumber", "email", "money"]);

        // Three leaf strings -> exactly three parses, not three * ruleCount.
        expect(nlpMock).toHaveBeenCalledTimes(3);
    });

    it("does not parse at all when no NLP-backed rule is supplied", () => {
        expect.assertions(2);

        const result = redact({ password: "John Doe works at Google" }, ["password"]);

        expect(nlpMock).not.toHaveBeenCalled();
        expect(result).toStrictEqual({ password: "<PASSWORD>" });
    });
});
