import { vi } from "vitest";

export const HOUR = 60 * 60 * 1000;

/**
 * Runs `function_` with the clock set `ms` back, so what it creates (upload records, objects) is
 * that old. Only `Date` is faked: timers and I/O run as usual.
 * @param ms How far back to set the clock
 * @param function_ Work to run in the past
 * @returns What `function_` returns
 */
export const createdAgo = async <T>(ms: number, function_: () => Promise<T>): Promise<T> => {
    vi.useFakeTimers({ now: Date.now() - ms, toFake: ["Date"] });

    try {
        return await function_();
    } finally {
        vi.useRealTimers();
    }
};
