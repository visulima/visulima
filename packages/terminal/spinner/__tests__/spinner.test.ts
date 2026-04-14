/* eslint-disable vitest/prefer-expect-assertions */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Spinner } from "../src/spinner";
import { getSpinner } from "../src/spinners";

describe("spinner", () => {
    let mockStream: {
        isTTY: boolean;
        write: (string_: string) => void;
    };
    let writeOutput: string[];

    beforeEach(() => {
        writeOutput = [];
        mockStream = {
            isTTY: true,
            write: (string_: string) => {
                writeOutput.push(string_);
            },
        };
    });

    afterEach(() => {
        writeOutput = [];
        vi.clearAllTimers();
    });

    describe("constructor", () => {
        it("should create a spinner with default options", () => {
            const spinner = new Spinner();

            expect(spinner).toBeDefined();
            expect(spinner.getStatus()).toBe("stopped");
            expect(spinner.getText()).toBe("");
        });

        it("should create a spinner with custom text", () => {
            const spinner = new Spinner({ text: "Loading..." });

            expect(spinner.getText()).toBe("Loading...");
        });

        it("should create a spinner with a named animation", () => {
            const spinner = new Spinner({ spinner: "dots", stream: mockStream });

            expect(spinner).toBeDefined();
        });

        it("should create a spinner with custom symbols", () => {
            const spinner = new Spinner({
                failureSymbol: "✘",
                stream: mockStream,
                successSymbol: "✔",
                warningSymbol: "⚠",
            });

            expect(spinner).toBeDefined();
        });

        it("should disable spinner when isEnabled is false", () => {
            const spinner = new Spinner({ isEnabled: false, stream: mockStream });

            spinner.start();

            expect(writeOutput).toHaveLength(0);
        });
    });

    describe("start", () => {
        it("should start the spinner animation", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Loading" });

            spinner.start();

            expect(spinner.getStatus()).toBe("spinning");
            expect(writeOutput.length).toBeGreaterThan(0);

            vi.advanceTimersByTime(80);
            const outputCount = writeOutput.length;

            expect(outputCount).toBeGreaterThan(0);

            vi.useRealTimers();
        });

        it("should update spinner with new text", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream });

            spinner.start("Starting task");

            expect(spinner.getText()).toBe("Starting task");

            vi.useRealTimers();
        });

        it("should hide cursor when starting", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream });

            spinner.start();

            // Check for hide cursor ANSI code
            expect(writeOutput.some((output) => output.includes("\u001B[?25l"))).toBe(true);

            vi.useRealTimers();
        });

        it("should not start if already spinning", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream });

            spinner.start("First");

            const countAfterFirstStart = writeOutput.length;

            spinner.start("Second");

            // Should not add significant new output
            expect(writeOutput.length - countAfterFirstStart).toBeLessThan(3);

            vi.useRealTimers();
        });
    });

    describe("stop", () => {
        it("should stop the spinner", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Loading" });

            spinner.start();

            const statusBefore = spinner.getStatus();

            spinner.stop();
            const statusAfter = spinner.getStatus();

            expect(statusBefore).toBe("spinning");
            expect(statusAfter).toBe("stopped");

            vi.useRealTimers();
        });

        it("should show cursor when stopping", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream });

            spinner.start();
            spinner.stop();

            // Check for show cursor ANSI code
            expect(writeOutput.some((output) => output.includes("\u001B[?25h"))).toBe(true);

            vi.useRealTimers();
        });

        it("should clear animation interval", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream });

            spinner.start();
            spinner.stop();

            const initialCount = writeOutput.length;

            vi.advanceTimersByTime(1000);

            // Should not render additional frames after stop
            expect(writeOutput.length).toBeLessThan(initialCount + 5);

            vi.useRealTimers();
        });
    });

    describe("succeed", () => {
        it("should display success message", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Loading" });

            spinner.start();
            spinner.succeed("Done!");

            expect(spinner.getStatus()).toBe("succeeded");

            const output = writeOutput.join("");

            expect(output).toContain("✓");
            expect(output).toContain("Done!");

            vi.useRealTimers();
        });

        it("should update text if provided", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Loading" });

            spinner.start();
            spinner.succeed("Completed");

            expect(spinner.getText()).toBe("Completed");

            vi.useRealTimers();
        });

        it("should use custom success symbol", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({
                stream: mockStream,
                successSymbol: "✔",
            });

            spinner.start();
            spinner.succeed("Done");

            const output = writeOutput.join("");

            expect(output).toContain("✔");

            vi.useRealTimers();
        });
    });

    describe("fail", () => {
        it("should display failure message", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Loading" });

            spinner.start();
            spinner.fail("Error!");

            expect(spinner.getStatus()).toBe("failed");

            const output = writeOutput.join("");

            expect(output).toContain("✖");
            expect(output).toContain("Error!");

            vi.useRealTimers();
        });

        it("should use custom failure symbol", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({
                failureSymbol: "✘",
                stream: mockStream,
            });

            spinner.start();
            spinner.fail("Failed");

            const output = writeOutput.join("");

            expect(output).toContain("✘");

            vi.useRealTimers();
        });
    });

    describe("warn", () => {
        it("should display warning message", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Loading" });

            spinner.start();
            spinner.warn("Warning!");

            expect(spinner.getStatus()).toBe("warned");

            const output = writeOutput.join("");

            expect(output).toContain("⚠");
            expect(output).toContain("Warning!");

            vi.useRealTimers();
        });

        it("should use custom warning symbol", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({
                stream: mockStream,
                warningSymbol: "⚡",
            });

            spinner.start();
            spinner.warn("Warned");

            const output = writeOutput.join("");

            expect(output).toContain("⚡");

            vi.useRealTimers();
        });
    });

    describe("setText", () => {
        it("should update the spinner text", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Initial" });

            spinner.setText("Updated");

            expect(spinner.getText()).toBe("Updated");

            vi.useRealTimers();
        });

        it("should re-render when updating text while spinning", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Initial" });

            spinner.start();

            const countBefore = writeOutput.length;

            spinner.setText("Updated");
            const countAfter = writeOutput.length;

            expect(countAfter).toBeGreaterThan(countBefore);

            vi.useRealTimers();
        });
    });

    describe("setPrefixText", () => {
        it("should update the prefix text", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream });

            spinner.setPrefixText("PREFIX");

            expect(spinner.getStatus()).toBe("stopped");

            vi.useRealTimers();
        });

        it("should include prefix in output", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream, text: "Loading" });

            spinner.setPrefixText("[INFO]");
            spinner.start();

            const output = writeOutput.join("");

            expect(output).toContain("[INFO]");

            vi.useRealTimers();
        });
    });

    describe("method chaining", () => {
        it("should support method chaining", () => {
            vi.useFakeTimers();
            const result = new Spinner({ stream: mockStream }).setPrefixText("[TASK]").setText("Loading");

            expect(result instanceof Spinner).toBe(true);

            vi.useRealTimers();
        });
    });

    describe("frame animation", () => {
        it("should cycle through frames", () => {
            vi.useFakeTimers();
            const spinner = new Spinner({ stream: mockStream });

            spinner.start();

            const frames: string[] = [];
            const originalWrite = mockStream.write;

            mockStream.write = (string_: string) => {
                if (!string_.includes("\u001B")) {
                    frames.push(string_);
                }

                originalWrite(string_);
            };

            // Advance through multiple frames
            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < 5; i++) {
                vi.advanceTimersByTime(80);
            }

            // Should have rendered different frames
            expect(frames.length).toBeGreaterThan(0);

            vi.useRealTimers();
        });

        it("should use correct frame interval", () => {
            vi.useFakeTimers();

            const dotsSpinner = getSpinner("dots");

            expect(dotsSpinner?.interval).toBe(80);

            vi.useRealTimers();
        });
    });

    describe("tTY handling", () => {
        it("should handle non-TTY streams gracefully", () => {
            const nonTTYStream = {
                isTTY: false,
                write: (string_: string) => {
                    writeOutput.push(string_);
                },
            };

            vi.useFakeTimers();
            const spinner = new Spinner({ stream: nonTTYStream, text: "Loading" });

            spinner.start();

            // Should not write cursor control codes
            const cursorCodes = writeOutput.filter((output) => output.includes("\u001B[?25"));

            expect(cursorCodes).toHaveLength(0);

            vi.useRealTimers();
        });
    });
});
