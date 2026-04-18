import { describe, expect, it } from "vitest";

import { createLogReporter, LogReporter } from "../src/log-reporter";
import type { Task } from "../src/types";

const makeTask = (project: string, target: string): Task => {
    return {
        id: `${project}:${target}`,
        outputs: [],
        overrides: {},
        target: { project, target },
    };
};

const capture = () => {
    let output = "";

    return {
        get value() {
            return output;
        },
        write: (chunk: string) => {
            output += chunk;
        },
    };
};

describe(LogReporter, () => {
    it("interleaved passes output through and guarantees trailing newline", () => {
        expect.assertions(1);

        const buffer = capture();
        const reporter = createLogReporter("interleaved", buffer.write);

        reporter.printTaskTerminalOutput(makeTask("app", "build"), "success", "line1\nline2");

        expect(buffer.value).toBe("line1\nline2\n");
    });

    it("labeled prefixes each line with [project#target]", () => {
        expect.assertions(1);

        const buffer = capture();
        const reporter = createLogReporter("labeled", buffer.write);

        reporter.printTaskTerminalOutput(makeTask("app", "build"), "success", "line1\nline2\n");

        expect(buffer.value).toBe("[app#build] line1\n[app#build] line2\n");
    });

    it("grouped prints a header then the block", () => {
        expect.assertions(1);

        const buffer = capture();
        const reporter = createLogReporter("grouped", buffer.write);

        reporter.printTaskTerminalOutput(makeTask("docs", "dev"), "success", "ready");

        expect(buffer.value).toBe("── docs#dev ──\nready\n\n");
    });

    it("is a no-op when output is empty", () => {
        expect.assertions(1);

        const buffer = capture();
        const reporter = createLogReporter("labeled", buffer.write);

        reporter.printTaskTerminalOutput(makeTask("app", "test"), "success", "");

        expect(buffer.value).toBe("");
    });

    it("preserves an already-trailing newline without doubling it", () => {
        expect.assertions(1);

        const buffer = capture();
        const reporter = createLogReporter("labeled", buffer.write);

        reporter.printTaskTerminalOutput(makeTask("app", "build"), "success", "one\n");

        expect(buffer.value).toBe("[app#build] one\n");
    });
});
