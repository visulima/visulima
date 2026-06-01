import type { Solution, SolutionFinder } from "@visulima/error/solution";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { ansiHandler, cliHandler } from "../../src/handler/cli-handler";

describe(ansiHandler, () => {
    it("should return the rendered error string when no solution finder produces a hint", async () => {
        expect.assertions(1);

        const noopFinder: SolutionFinder = {
            // eslint-disable-next-line @typescript-eslint/require-await -- satisfies the Promise-returning SolutionFinder.handle contract
            handle: async () => undefined,
            name: "test-noop",
            priority: 1,
        };

        const error = new Error("boom from ansiHandler");
        const result = await ansiHandler(error, { solutionFinders: [noopFinder] });

        expectTypeOf(result).toBeString();

        expect(result).toContain("boom from ansiHandler");
    });

    it("should append a solution box when a solution finder returns a hint", async () => {
        expect.assertions(3);

        const matchingFinder: SolutionFinder = {
            // eslint-disable-next-line @typescript-eslint/require-await -- satisfies the Promise-returning SolutionFinder.handle contract
            handle: async (): Promise<Solution> => {
                return {
                    body: "Try restarting the universe",
                    header: "Hint",
                };
            },
            name: "test-match",
            priority: 1,
        };

        const error = new Error("matching solution");
        const result = await ansiHandler(error, { solutionFinders: [matchingFinder] });

        expect(result).toContain("matching solution");
        expect(result).toContain("Try restarting the universe");

        // Boxen renders the header text — we strip ansi for substring match.
        // eslint-disable-next-line no-control-regex
        const stripped = result.replaceAll(/\[[0-9;]*m/g, "");

        expect(stripped).toContain("Hint");
    });

    it("should work with no options provided (defaults)", async () => {
        expect.assertions(1);

        const result = await ansiHandler(new Error("default options"));

        expect(result).toContain("default options");
    });
});

describe("cliHandler (terminalOutput)", () => {
    it("should log the error via the supplied logger when no solution is found", async () => {
        expect.assertions(3);

        const errorSpy = vi.fn<(...args: unknown[]) => void>();
        const logSpy = vi.fn<(...args: unknown[]) => void>();

        await cliHandler(new Error("logger error"), {
            logger: { error: errorSpy, log: logSpy },
            solutionFinders: [],
        });

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy.mock.calls[0][0]).toContain("logger error");
        // No solution => no extra log lines
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("should also log the solution when a finder returns a hint", async () => {
        expect.assertions(3);

        const errorSpy = vi.fn<(...args: unknown[]) => void>();
        const logSpy = vi.fn<(...args: unknown[]) => void>();

        const finder: SolutionFinder = {
            // eslint-disable-next-line @typescript-eslint/require-await -- satisfies the Promise-returning SolutionFinder.handle contract
            handle: async () => {
                return {
                    body: "Sometimes you have to turn it off and on again.",
                    header: "Possible fix",
                };
            },
            name: "test-hint",
            priority: 1,
        };

        await cliHandler(new Error("needs solution"), {
            logger: { error: errorSpy, log: logSpy },
            solutionFinders: [finder],
        });

        expect(errorSpy).toHaveBeenCalledTimes(1);
        // First log call is empty line spacer; second log is the box.
        expect(logSpy).toHaveBeenCalledTimes(2);
        expect(logSpy.mock.calls[1][0]).toContain("Sometimes you have to turn it off and on again.");
    });

    it("should default to console when no logger option is provided", async () => {
        expect.assertions(1);

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await cliHandler(new Error("default logger"));

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

        consoleErrorSpy.mockRestore();
    });
});
