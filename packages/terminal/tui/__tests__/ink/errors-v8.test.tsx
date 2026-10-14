import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import { strip as stripAnsi } from "@visulima/ansi";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorOverview } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString as renderToStringHelper } from "../helpers/ink-render";

const sourceDirectory = mkdtempSync(join(tmpdir(), "tui-error-source-"));
const sourceFile = join(sourceDirectory, "error source.txt");

writeFileSync(sourceFile, "throw new Error('Source excerpt marker');\n");

const createErrorWithStack = (stack: string, message = "Oh no"): Error => {
    const error = new Error(message);

    error.stack = stack;

    return error;
};

const renderError = (error: Error): string => stripAnsi(renderToStringHelper(<ErrorOverview error={error} />));

describe("error overview", () => {
    afterAll(() => {
        rmSync(sourceDirectory, { force: true, recursive: true });
    });

    it("renders source excerpts for file URLs containing spaces", () => {
        expect.hasAssertions();

        const sourceUrl = pathToFileURL(sourceFile);
        const output = renderError(createErrorWithStack(`Error: Oh no\n    at ${sourceUrl.href}:1:1`));

        expect(output).toContain("throw new Error('Source excerpt marker');");
        expect(output).toContain("error source.txt:1:1");
    });

    it("renders the original error when its source path cannot be read", () => {
        expect.hasAssertions();

        const sourceUrl = pathToFileURL(`${sourceDirectory}/`);
        const output = renderError(createErrorWithStack(`Error: Oh no\n    at ${sourceUrl.href}:1:1`));

        expect(output).toContain("Oh no");
        expect(output).toContain(`${sourceDirectory}/:1:1`);
    });

    it("renders the original error when its source file is missing", () => {
        expect.hasAssertions();

        const output = renderError(createErrorWithStack("Error: Oh no\n    at missing-source-file.js:1:1"));

        expect(output).toContain("Oh no");
        expect(output).toContain("missing-source-file.js:1:1");
    });

    it("does not treat multi-line messages as stack frames", () => {
        expect.hasAssertions();

        const sourceUrl = pathToFileURL(sourceFile);
        const error = createErrorWithStack(
            `Error: Validation failed\nRequired field is missing\n    at ${sourceUrl.href}:1:1`,
            "Validation failed\nRequired field is missing",
        );
        const output = renderError(error);

        expect(output).toContain("throw new Error('Source excerpt marker');");
        expect(output).toContain("Validation failed");
        expect(output.split("Required field is missing")).toHaveLength(2);
    });

    it("renders native stack frames as raw lines", () => {
        expect.hasAssertions();

        const output = renderError(createErrorWithStack("Error: Oh no\n    at native"));

        expect(output).toContain("- ");
        expect(output).toContain("at native");
        expect(output).not.toContain("undefined");
    });

    it("renders named native stack frames as raw lines", () => {
        expect.hasAssertions();

        const output = renderError(createErrorWithStack("Error: Oh no\n    at foo (native)"));

        expect(output).toContain("at foo (native)");
        expect(output).not.toContain("undefined");
    });

    it("does not emit duplicate key warnings for repeated stack lines", () => {
        expect.hasAssertions();

        const consoleErrors = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            renderError(createErrorWithStack("Error: Oh no\n    at native\n    at native\n    at native"));

            const messages = consoleErrors.mock.calls.map((call) => call.join(" "));

            expect(messages.some((message) => message.includes("same key"))).toBe(false);
        } finally {
            consoleErrors.mockRestore();
        }
    });
});

describe("error reporting", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("displays thrown strings and rejects waitUntilExit with the original message", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const Test = (): never => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw "Unable to load configuration";
        };

        const app = render(<Test />, { stdout });

        await expect(app.waitUntilExit()).rejects.toThrow("Unable to load configuration");

        const output = stripAnsi(stdout.getWrites().join(""));

        expect(output).toContain("ERROR");
        expect(output).toContain("Unable to load configuration");
    });

    it("displays thrown undefined and rejects waitUntilExit", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const Test = (): never => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw undefined;
        };

        const app = render(<Test />, { stdout });

        await expect(app.waitUntilExit()).rejects.toThrow("undefined");

        expect(stripAnsi(stdout.getWrites().join(""))).toContain("ERROR  undefined");
    });

    it("waitUntilExit preserves the original component error", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const error = new Error("Original component error");
        const Test = (): never => {
            throw error;
        };

        const app = render(<Test />, { stdout });

        await expect(app.waitUntilExit()).rejects.toBe(error);
    });

    it("waitUntilExit preserves a component error from another realm", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const error = vm.runInNewContext("new Error(\"Cross-realm component error\")") as Error;
        const Test = (): never => {
            throw error;
        };

        const app = render(<Test />, { stdout });

        await expect(app.waitUntilExit()).rejects.toBe(error);
    });
});
