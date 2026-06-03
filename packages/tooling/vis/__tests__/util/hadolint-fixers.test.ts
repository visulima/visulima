import { describe, expect, it } from "vitest";

import type { HadolintFinding } from "../../src/util/hadolint";
import { applyFixers, AUTOFIXABLE_CODES } from "../../src/util/hadolint/fixers";

const finding = (code: string, line: number): HadolintFinding => {
    return {
        code,
        column: 1,
        file: "Dockerfile",
        level: "warning",
        line,
        message: code,
    };
};

describe("hadolint fixers", () => {
    it("exposes the fixable code set", () => {
        expect.assertions(2);

        expect(AUTOFIXABLE_CODES.has("DL3015")).toBe(true);
        expect(AUTOFIXABLE_CODES.has("DL3006")).toBe(false);
    });

    it("applies DL3015 --no-install-recommends", () => {
        expect.assertions(2);

        const original = "RUN apt-get install curl\n";
        const result = applyFixers(original, [finding("DL3015", 1)]);

        expect(result.content).toContain("apt-get install --no-install-recommends curl");
        expect(result.fixedCount).toBe(1);
    });

    it("applies DL3014 -y and composes with DL3015 on the same line", () => {
        expect.assertions(2);

        const original = "RUN apt-get install curl\n";
        const result = applyFixers(original, [finding("DL3014", 1), finding("DL3015", 1)]);

        expect(result.content).toContain("-y");
        expect(result.content).toContain("--no-install-recommends");
    });

    it("rewrites ADD to COPY for DL3020", () => {
        expect.assertions(1);

        const result = applyFixers("ADD ./src /app\n", [finding("DL3020", 1)]);

        expect(result.content).toBe("COPY ./src /app\n");
    });

    it("does not touch lines for non-fixable codes", () => {
        expect.assertions(2);

        const original = "FROM node:latest\n";
        const result = applyFixers(original, [finding("DL3007", 1)]);

        expect(result.content).toBe(original);
        expect(result.fixedCount).toBe(0);
    });

    it("is a no-op when the flag is already present", () => {
        expect.assertions(1);

        const original = "RUN apt-get install --no-install-recommends -y curl\n";
        const result = applyFixers(original, [finding("DL3015", 1), finding("DL3014", 1)]);

        expect(result.fixedCount).toBe(0);
    });

    it("ignores findings pointing past the end of the file", () => {
        expect.assertions(1);

        const result = applyFixers("FROM node:22\n", [finding("DL3020", 99)]);

        expect(result.fixedCount).toBe(0);
    });

    it("preserves CRLF line endings", () => {
        expect.assertions(1);

        const result = applyFixers("ADD a b\r\nADD c d\r\n", [finding("DL3020", 1)]);

        expect(result.content).toBe("COPY a b\r\nADD c d\r\n");
    });
});
