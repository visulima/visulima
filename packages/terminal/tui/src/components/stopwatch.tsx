import type { ReactElement, Ref } from "react";
import { useImperativeHandle } from "react";

import type { UseStopwatchResult } from "../ink/hooks/use-stopwatch";
import useStopwatch from "../ink/hooks/use-stopwatch";
import { formatDuration } from "../ink/utils/format-time";
import Text from "./text";

export type StopwatchRef = Omit<UseStopwatchResult, "elapsed" | "isRunning" | "laps">;

export type Props = {
    /**
     * Whether to start counting immediately.
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
     * Custom formatter for the elapsed time.
     * Receives elapsed milliseconds, returns a display string.
     * @default formatDuration (MM:SS or HH:MM:SS)
     */
    readonly format?: (elapsed: number) => string;

    /**
     * Tick interval in milliseconds.
     * @default 1000
     */
    readonly interval?: number;

    readonly ref?: Ref<StopwatchRef>;
};

/**
 * A count-up stopwatch component.
 *
 * Exposes `start`, `stop`, `toggle`, `reset`, and `lap` methods via ref.
 *
 * ```tsx
 * const ref = useRef&lt;StopwatchRef>(null);
 * &lt;Stopwatch ref={ref} autoStart />
 * ```
 */
const Stopwatch = ({ autoStart, bold, color, format = formatDuration, interval, ref }: Props): ReactElement => {
    const sw = useStopwatch({ autoStart, interval });

    useImperativeHandle(ref, () => {
        return {
            lap: sw.lap,
            reset: sw.reset,
            start: sw.start,
            stop: sw.stop,
            toggle: sw.toggle,
        };
    }, [sw.lap, sw.reset, sw.start, sw.stop, sw.toggle]);

    return (
        <Text bold={bold} color={color}>
            {format(sw.elapsed)}
        </Text>
    );
};

export default Stopwatch;

export { Stopwatch };
export type { Props as StopwatchProps };
