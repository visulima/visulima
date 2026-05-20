// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export interface ThrottledFunction<T extends AnyFunction> {
    (...args: Parameters<T>): ReturnType<T> | undefined;
    cancel: () => void;
    flush: () => ReturnType<T> | undefined;
}

export interface ThrottleOptions {
    leading?: boolean;
    trailing?: boolean;
}

/**
 * Drop-in replacement for `throttle` from `es-toolkit/compat`, scoped to the
 * leading/trailing edges used by the ink renderer. Mirrors lodash semantics by
 * delegating to a debounce with `maxWait === wait`, so continuous demand
 * still produces an invocation every `wait` ms.
 */
export function throttle<T extends AnyFunction>(
    function_: T,
    wait: number | undefined = 0,
    options: ThrottleOptions = {},
): ThrottledFunction<T> {
    const leading = options.leading ?? true;
    const trailing = options.trailing ?? true;

    let timerId: ReturnType<typeof setTimeout> | undefined;
    let pendingArgs: Parameters<T> | undefined;
    let maxWaitStart: number | undefined;
    let lastResult: ReturnType<T> | undefined;

    const invoke = (): void => {
        if (pendingArgs === undefined) {
            return;
        }

        const args = pendingArgs;

        pendingArgs = undefined;
        lastResult = function_(...args) as ReturnType<T>;
    };

    const clearTimer = (): void => {
        if (timerId !== undefined) {
            clearTimeout(timerId);
            timerId = undefined;
        }
    };

    const onTimerEnd = (): void => {
        timerId = undefined;

        if (trailing) {
            invoke();
        }

        pendingArgs = undefined;
        maxWaitStart = undefined;
    };

    const scheduleTimer = (): void => {
        clearTimer();
        timerId = setTimeout(onTimerEnd, wait);
    };

    const throttled = function throttled(...args: Parameters<T>): ReturnType<T> | undefined {
        const now = Date.now();

        maxWaitStart ??= now;

        // Force an invocation when continuous demand exceeds the throttle
        // window — matches the maxWait behavior of es-toolkit/compat.
        if (now - maxWaitStart >= wait) {
            pendingArgs = args;
            invoke();
            maxWaitStart = now;
            scheduleTimer();

            return lastResult;
        }

        pendingArgs = args;

        const isFirstCall = timerId === undefined;

        scheduleTimer();

        if (leading && isFirstCall) {
            invoke();
        }

        return lastResult;
    } as ThrottledFunction<T>;

    throttled.cancel = (): void => {
        clearTimer();
        pendingArgs = undefined;
        maxWaitStart = undefined;
    };

    throttled.flush = (): ReturnType<T> | undefined => {
        clearTimer();
        invoke();
        maxWaitStart = undefined;

        return lastResult;
    };

    return throttled;
}
