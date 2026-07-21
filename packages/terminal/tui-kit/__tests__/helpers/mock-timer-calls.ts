const mockTimerCalls = () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;

    let setTimeoutCallCount = 0;
    let clearTimeoutCallCount = 0;
    const timeoutDelays: number[] = [];

    globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        setTimeoutCallCount++;
        timeoutDelays.push(timeout ?? 0);

        return originalSetTimeout(handler, timeout, ...args);
    }) as typeof setTimeout;

    globalThis.clearTimeout = (timer: ReturnType<typeof setTimeout>) => {
        clearTimeoutCallCount++;
        originalClearTimeout(timer);
    };

    return {
        get clearTimeoutCallCount() {
            return clearTimeoutCallCount;
        },
        restore() {
            globalThis.setTimeout = originalSetTimeout;
            globalThis.clearTimeout = originalClearTimeout;
        },
        get setTimeoutCallCount() {
            return setTimeoutCallCount;
        },
        get timeoutDelays() {
            return timeoutDelays;
        },
    };
};

export default mockTimerCalls;
