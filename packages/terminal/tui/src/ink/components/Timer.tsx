import type { ForwardRefExoticComponent, ReactElement, RefAttributes } from "react";
import { forwardRef, useImperativeHandle } from "react";

import type { UseTimerResult } from "../hooks/use-timer";
import useTimer from "../hooks/use-timer";
import { formatDuration } from "../utils/format-time";
import Text from "./Text";

export type TimerRef = Omit<UseTimerResult, "isFinished" | "isRunning" | "remaining">;

export type Props = {
    /**
     * Whether to start the timer immediately.
     *
     * @default false
     */
    readonly autoStart?: boolean;

    /**
     * Make the rendered text bold.
     */
    readonly bold?: boolean;

    /**
     * Text color for the rendered time.
     */
    readonly color?: string;

    /**
     * Total countdown duration in milliseconds.
     */
    readonly duration: number;

    /**
     * Custom formatter for the remaining time.
     * Receives remaining milliseconds, returns a display string.
     *
     * @default formatDuration (MM:SS or HH:MM:SS)
     */
    readonly format?: (remaining: number) => string;

    /**
     * Tick interval in milliseconds.
     *
     * @default 1000
     */
    readonly interval?: number;

    /**
     * Called once when the timer reaches zero.
     */
    readonly onTimeout?: () => void;
};

/**
 * A countdown timer component.
 *
 * Exposes `start`, `stop`, `toggle`, and `reset` methods via ref.
 *
 * ```tsx
 * const ref = useRef<TimerRef>(null);
 * <Timer ref={ref} duration={60_000} autoStart />
 * ```
 */
const Timer: ForwardRefExoticComponent<Props & RefAttributes<TimerRef>> = forwardRef<TimerRef, Props>(function Timer(
    { autoStart, bold, color, duration, format = formatDuration, interval, onTimeout },
    ref,
): ReactElement {
    const timer = useTimer({ autoStart, duration, interval, onTimeout });

    useImperativeHandle(
        ref,
        () => ({
            reset: timer.reset,
            start: timer.start,
            stop: timer.stop,
            toggle: timer.toggle,
        }),
        [timer.reset, timer.start, timer.stop, timer.toggle],
    );

    return (
        <Text bold={bold} color={color}>
            {format(timer.remaining)}
        </Text>
    );
});

export default Timer;
