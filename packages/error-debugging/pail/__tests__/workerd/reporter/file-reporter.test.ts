// `/tmp` here is workerd's in-isolate virtual filesystem, not a shared host directory.
/* eslint-disable sonarjs/publicly-writable-directories */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { JsonFileReporter } from "../../../src/reporter/file/json-file-reporter";
import RotatingFileStream from "../../../src/reporter/file/utils/rotating-file-stream";
import type { ReadonlyMeta } from "../../../src/types";

const meta = (message: string): ReadonlyMeta<never> =>
    ({
        badge: undefined,
        context: [],
        date: new Date(0),
        error: undefined,
        file: undefined,
        groups: [],
        label: "info",
        message,
        prefix: undefined,
        scope: undefined,
        suffix: undefined,
        traceError: undefined,
        type: { level: "informational", name: "info" },
    }) as unknown as ReadonlyMeta<never>;

const settle = async (ms = 200): Promise<void> => {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

describe("file reporter in workerd", () => {
    it("imports without evaluating any filesystem access", () => {
        expect.assertions(2);

        // A logger that merely *includes* the file reporter in its bundle must not blow up
        // at import time on a runtime without a filesystem.
        expect(JsonFileReporter).toBeTypeOf("function");
        expect(RotatingFileStream).toBeTypeOf("function");
    });

    it("either constructs or fails with an actionable error, never an obscure crash", () => {
        expect.assertions(1);

        let outcome: string;

        try {
            // eslint-disable-next-line no-new
            new RotatingFileStream("/tmp/pail-workerd-probe.log", false, {});
            outcome = "constructed";
        } catch (error) {
            outcome = (error as Error).message;
        }

        // workerd's `nodejs_compat` exposes an in-memory `node:fs`, so construction succeeds.
        // On a runtime that lacks it, the documented failure is the explicit missing-package
        // error rather than a `ReferenceError`/`TypeError` from deep inside a Node builtin.
        expect(["constructed", "The 'rotating-file-stream' package is missing. Make sure to install the 'rotating-file-stream' package."]).toContain(outcome);
    });

    it("writes JSON lines into the workerd in-memory filesystem", async () => {
        expect.assertions(2);

        const filePath = `/tmp/pail-workerd-file-reporter-${String(Date.now())}.log`;
        const reporter = new JsonFileReporter({ filePath });

        reporter.setStringify(JSON.stringify as never);
        reporter.log(meta("first"));
        reporter.log(meta("second"));
        reporter.close();

        await settle();

        const lines = readFileSync(filePath, "utf8").trim().split("\n");

        expect(lines).toHaveLength(2);
        expect(lines.map((line) => (JSON.parse(line) as { message: string }).message)).toStrictEqual(["first", "second"]);
    });

    it("exposes dispose() as an alias for close()", () => {
        expect.assertions(1);

        const reporter = new JsonFileReporter({ filePath: "/tmp/pail-workerd-dispose.log" });

        reporter.setStringify(JSON.stringify as never);

        expect(() => { reporter.dispose(); }).not.toThrow();
    });
});
