import { describe, expect, it, vi } from "vitest";

import { EMPTY_SYMBOL } from "../../../../src/constants";
import { JsonFileReporter } from "../../../../src/reporter/file/json-file-reporter";
import type { Meta } from "../../../../src/types";

describe("jsonFileReporter", () => {
    it("should correctly format and write log messages to the file", () => {
        expect.assertions(1);

        const options = { filePath: "test.log" };
        const reporter = new JsonFileReporter(options);

        const meta = {
            badge: "informational",
            context: [],
            date: new Date(),
            error: undefined,
            groups: ["group1"],
            label: "Test Label",
            message: "Test message",
            prefix: undefined,
            scope: ["scope1"],
            suffix: undefined,
            traceError: undefined,
            type: { level: "informational", name: "informational" },
        } satisfies Meta<never>;

        reporter.setStringify(JSON.stringify);

        // @ts-expect-error - The spy is private
        const writeSpy = vi.spyOn(reporter.stream, "write");

        reporter.log(meta);

        expect(writeSpy).toHaveBeenCalledExactlyOnceWith(
            `{"badge":"informational","date":"${
                meta.date.toISOString()
            }","groups":["group1"],"label":"Test Label","scope":["scope1"],"message":"Test message","context":[]}\n`,
        );
    });

    it("should handle undefined values in meta properties", () => {
        expect.assertions(1);

        const options = { filePath: "test.log" };
        const reporter = new JsonFileReporter(options);
        const meta = {
            badge: undefined,
            context: [],
            date: new Date(),
            error: undefined,
            file: undefined,
            groups: [],
            label: undefined,
            message: EMPTY_SYMBOL,
            prefix: undefined,
            scope: undefined,
            suffix: undefined,
            traceError: undefined,
            type: { level: "informational", name: "informational" },
        };

        reporter.setStringify(JSON.stringify);

        expect(() => reporter.log(meta as Meta<never>)).not.toThrow();
    });
});
