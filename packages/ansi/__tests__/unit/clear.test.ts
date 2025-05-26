import { afterEach, describe, expect, it, vi } from "vitest";

import { clearLineAndHomeCursor, clearScreenAndHomeCursor, clearScreenFromTopLeft, resetTerminal } from "../../src/clear";
import { CSI } from "../../src/constants";

const mocked = vi.hoisted(() => {
    return {
        isWindows: vi.fn(),
    };
});

vi.mock("../../src/helpers", async (importOriginal) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actualHelpers = await importOriginal<any>();

    return {
        ...actualHelpers,
        isWindows: mocked.isWindows,
    };
});

describe("clear utilities", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    describe(clearScreenFromTopLeft, () => {
        it("should be the combination of cursorTo(0,0) and eraseDisplay(ToEnd)", async () => {
            expect.assertions(1);
            expect(clearScreenFromTopLeft).toBe(`${CSI}1;1H${CSI}J`);
        });
    });

    describe(clearLineAndHomeCursor, () => {
        it("should be the combination of eraseLine(EntireLine) and cursorToColumn(0)", async () => {
            expect.assertions(1);
            expect(clearLineAndHomeCursor).toBe(`${CSI}2K${CSI}G`);
        });
    });

    describe(clearScreenAndHomeCursor, () => {
        it("should be the combination of cursorTo(0,0) and eraseDisplay(EntireScreen)", async () => {
            expect.assertions(1);
            expect(clearScreenAndHomeCursor).toBe(`${CSI}H${CSI}2J`);
        });
    });

    describe(resetTerminal, () => {
        it("should produce correct sequence when isWindows is false", async () => {
            expect.assertions(1);

            mocked.isWindows.mockReturnValue(false);

            expect(resetTerminal).toBe(`${CSI}2J${CSI}0f`);
        });

        it("should produce correct sequence when isWindows is true", async () => {
            expect.assertions(1);

            mocked.isWindows.mockReturnValue(true);

            const expectedWinReset = `${CSI}2J${CSI}0f`;

            expect(resetTerminal).toBe(expectedWinReset);
        });
    });
});
