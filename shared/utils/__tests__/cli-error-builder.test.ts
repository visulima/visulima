import type { SolutionFinder } from "@visulima/error/solution";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildOutput, terminalOutput } from "../cli-error-builder";

const matchingFinder: SolutionFinder = {
    handle: async () => ({ body: "Try turning it off and on again.", header: "Quick fix" }),
    name: "test-matching-finder",
    priority: 100,
};

const nonMatchingFinder: SolutionFinder = {
    handle: async () => undefined,
    name: "test-non-matching-finder",
    priority: 90,
};

describe("cli-error-builder", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("buildOutput", () => {
        it("renders the error ansi and no solution box when no finder matches", async () => {
            const error = new Error("boom");

            const { errorAnsi, solutionBox } = await buildOutput(error, { solutionFinders: [nonMatchingFinder] });

            expect(typeof errorAnsi).toBe("string");
            expect(errorAnsi.length).toBeGreaterThan(0);
            expect(solutionBox).toBeUndefined();
        });

        it("renders a solution box when a finder matches", async () => {
            const error = new Error("boom");

            const { solutionBox } = await buildOutput(error, { solutionFinders: [matchingFinder] });

            expect(solutionBox).toBeDefined();
            expect(solutionBox).toContain("Quick fix");
            expect(solutionBox).toContain("Try turning it off and on again.");
        });

        it("applies custom code-frame colors passed via color.codeFrame", async () => {
            const identity = (value: string) => value;
            const title = vi.fn((value: string) => `<<${value}>>`);
            const error = new Error("boom");

            const { errorAnsi } = await buildOutput(error, {
                color: { codeFrame: { fileLine: identity, hint: identity, method: identity, title } },
            });

            expect(title).toHaveBeenCalled();
            expect(errorAnsi).toContain("<<");
        });

        it("runs higher-priority solution finders first", async () => {
            const lowPriorityFinder: SolutionFinder = {
                handle: async () => ({ body: "low priority body", header: "Low priority" }),
                name: "low-priority-finder",
                priority: 50,
            };
            const highPriorityFinder: SolutionFinder = {
                handle: async () => ({ body: "high priority body", header: "High priority" }),
                name: "high-priority-finder",
                priority: 100,
            };

            const { solutionBox } = await buildOutput(new Error("boom"), {
                solutionFinders: [lowPriorityFinder, highPriorityFinder],
            });

            expect(solutionBox).toBeDefined();
            expect(solutionBox).toContain("High priority");
            expect(solutionBox).not.toContain("Low priority");
        });

        it("logs solution-finder progress through the injected logger when debug is true", async () => {
            const logger = { error: vi.fn(), log: vi.fn() };
            const error = new Error("boom");

            await buildOutput(error, { debug: true, solutionFinders: [matchingFinder] }, logger);

            const logged = logger.log.mock.calls.map((call) => String(call[0])).join("\n");

            expect(logged).toContain("running: test-matching-finder");
            expect(logged).toContain("matched: test-matching-finder");
        });

        it("does not log finder progress when debug is false", async () => {
            const logger = { error: vi.fn(), log: vi.fn() };

            await buildOutput(new Error("boom"), { debug: false, solutionFinders: [matchingFinder] }, logger);

            expect(logger.log).not.toHaveBeenCalled();
        });
    });

    describe("terminalOutput", () => {
        it("writes the error and solution box to the logger", async () => {
            const logger = { error: vi.fn(), log: vi.fn() };

            await terminalOutput(new Error("boom"), { logger, solutionFinders: [matchingFinder] });

            expect(logger.error).toHaveBeenCalledTimes(1);
            // empty spacer line + the solution box
            expect(logger.log).toHaveBeenCalledTimes(2);
        });

        it("writes only the error when no solution is found", async () => {
            const logger = { error: vi.fn(), log: vi.fn() };

            await terminalOutput(new Error("boom"), { logger, solutionFinders: [nonMatchingFinder] });

            expect(logger.error).toHaveBeenCalledTimes(1);
            expect(logger.log).not.toHaveBeenCalled();
        });
    });
});
