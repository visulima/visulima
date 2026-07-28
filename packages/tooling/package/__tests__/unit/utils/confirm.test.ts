import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import confirm from "../../../src/utils/confirm";

type QuestionCallback = (answer: string) => void;

interface FakeInterface {
    close: ReturnType<typeof vi.fn>;
    on: (event: string, listener: () => void) => FakeInterface;
    question: (query: string, callback: QuestionCallback) => void;
}

const { mockCreateInterface, state } = vi.hoisted(() => {
    return {
        // eslint-disable-next-line vitest/require-mock-type-parameters
        mockCreateInterface: vi.fn(),
        state: {
            lastQuery: "",
            questionCallback: undefined as QuestionCallback | undefined,
            sigintListener: undefined as (() => void) | undefined,
        },
    };
});

vi.mock(import("node:readline"), () => {
    return {
        createInterface: mockCreateInterface,
    };
});

describe(confirm, () => {
    let closeMock: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
        state.lastQuery = "";
        state.questionCallback = undefined;
        state.sigintListener = undefined;

        closeMock = vi.fn<() => void>();

        const fakeInterface: FakeInterface = {
            close: closeMock,
            on(event: string, listener: () => void): FakeInterface {
                if (event === "SIGINT") {
                    state.sigintListener = listener;
                }

                return fakeInterface;
            },
            question(query: string, callback: QuestionCallback): void {
                state.lastQuery = query;
                state.questionCallback = callback;
            },
        };

        mockCreateInterface.mockReturnValue(fakeInterface);

        // Silence the styled console output the prompt prints on each answer.
        vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it("should resolve to the default value (false) for an empty answer", async () => {
        expect.assertions(2);

        const promise = confirm({ message: "Proceed?" });

        state.questionCallback?.("");

        await expect(promise).resolves.toBe(false);
        expect(closeMock).toHaveBeenCalledTimes(1);
    });

    it("should resolve to the default value (true) for an empty answer when default is true", async () => {
        expect.assertions(2);

        const promise = confirm({ default: true, message: "Proceed?" });

        state.questionCallback?.("   ");

        await expect(promise).resolves.toBe(true);
        // The default hint should show an uppercase Y when default is true.
        expect(state.lastQuery).toContain("Y");
    });

    it("should resolve to true for 'y' / 'yes' answers", async () => {
        expect.assertions(2);

        const yesPromise = confirm({ message: "Proceed?" });

        state.questionCallback?.("y");

        await expect(yesPromise).resolves.toBe(true);

        const yesWordPromise = confirm({ message: "Proceed?" });

        state.questionCallback?.("YES");

        await expect(yesWordPromise).resolves.toBe(true);
    });

    it("should resolve to false for 'n' / 'no' answers", async () => {
        expect.assertions(2);

        const noPromise = confirm({ message: "Proceed?" });

        state.questionCallback?.("n");

        await expect(noPromise).resolves.toBe(false);

        const noWordPromise = confirm({ message: "Proceed?" });

        state.questionCallback?.("No");

        await expect(noWordPromise).resolves.toBe(false);
    });

    it("should fall back to the default value for invalid input", async () => {
        expect.assertions(1);

        const promise = confirm({ default: true, message: "Proceed?" });

        state.questionCallback?.("maybe");

        await expect(promise).resolves.toBe(true);
    });

    it("should use a custom transformer for the printed answer", async () => {
        expect.assertions(2);

        const labelFor = (answer: boolean): string => {
            if (answer) {
                return "AFFIRMATIVE";
            }

            return "NEGATIVE";
        };
        const transformer = vi.fn<(answer: boolean) => string>(labelFor);

        const promise = confirm({ message: "Proceed?", transformer });

        state.questionCallback?.("y");

        await expect(promise).resolves.toBe(true);
        expect(transformer).toHaveBeenCalledWith(true);
    });

    it("should resolve to false when SIGINT is received (default: false)", async () => {
        expect.assertions(2);

        const promise = confirm({ message: "Proceed?" });

        expect(state.sigintListener).toBeTypeOf("function");

        state.sigintListener?.();

        await expect(promise).resolves.toBe(false);
    });

    it("should resolve to false when SIGINT is received even with default: true", async () => {
        expect.assertions(2);

        const promise = confirm({ default: true, message: "Proceed?" });

        expect(state.sigintListener).toBeTypeOf("function");

        state.sigintListener?.();

        // Ctrl+C aborts; it must never be treated as accepting the (installing) default.
        await expect(promise).resolves.toBe(false);
    });
});
