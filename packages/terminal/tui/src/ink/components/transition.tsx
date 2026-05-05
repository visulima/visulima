/* eslint-disable react/function-component-definition */
import type { ReactElement, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import Box from "./box";
import Text from "./text";

export type TransitionPreset = "fade" | "reveal" | "slide-down" | "slide-left" | "slide-right" | "slide-up";

export type TransitionPhase = "entered" | "entering" | "exited" | "exiting";

export type Props = {
    /**
     * Content to animate.
     */
    readonly children: ReactNode;

    /**
     * For slide presets, how many characters of offset to animate across.
     * For the `reveal` preset, the maximum row count to scale through.
     * @default 4
     */
    readonly distance?: number;

    /**
     * Duration of both enter and exit transitions, in milliseconds.
     * @default 240
     */
    readonly duration?: number;

    /**
     * Called once the exit animation finishes (i.e. the component has fully
     * transitioned out). AnimatePresence uses this to unmount the wrapper.
     */
    readonly onExit?: () => void;

    /**
     * Animation preset controlling how the content appears/disappears.
     * @default "fade"
     */
    readonly preset?: TransitionPreset;

    /**
     * Controls the target phase. `true` drives towards `entered`, `false`
     * drives towards `exited`. Flip the value to trigger animation.
     * @default true
     */
    readonly show?: boolean;

    /**
     * Tick interval in milliseconds. Lower values yield smoother animation
     * at the cost of CPU.
     * @default 30
     */
    readonly tickInterval?: number;
};

type RenderProgress = (progress: number, children: ReactNode, distance: number) => ReactElement;

const renderFade: RenderProgress = (progress, children) => {
    // In a terminal there's no alpha — dim text once the transition is past
    // the halfway point to simulate a fade-in/out.
    if (progress >= 1) {
        return <Box>{children}</Box>;
    }

    if (progress <= 0) {
        return <Box />;
    }

    return <Box>{typeof children === "string" ? <Text dimColor={progress < 0.7}>{children}</Text> : children}</Box>;
};

const slideOffset = (progress: number, distance: number): number => Math.max(0, Math.min(distance, Math.round((1 - progress) * distance)));

const renderSlide =
    (axis: "x" | "y", sign: 1 | -1): RenderProgress =>
    (progress, children, distance) => {
        const offset = slideOffset(progress, distance);

        if (progress >= 1) {
            return <Box>{children}</Box>;
        }

        if (progress <= 0) {
            return <Box />;
        }

        if (axis === "x") {
            return (
                <Box paddingLeft={sign === 1 ? offset : 0} paddingRight={sign === -1 ? offset : 0}>
                    {children}
                </Box>
            );
        }

        return (
            <Box flexDirection="column" paddingBottom={sign === -1 ? offset : 0} paddingTop={sign === 1 ? offset : 0}>
                {children}
            </Box>
        );
    };

const renderReveal: RenderProgress = (progress, children, distance) => {
    // Wraps content in a Box whose height grows from 0 to `distance` rows.
    if (progress >= 1) {
        return <Box>{children}</Box>;
    }

    if (progress <= 0) {
        return <Box />;
    }

    const rows = Math.max(0, Math.min(distance, Math.round(progress * distance)));

    return (
        <Box flexDirection="column" height={rows} overflowY="hidden">
            {children}
        </Box>
    );
};

const PRESET_RENDERERS: Record<TransitionPreset, RenderProgress> = {
    fade: renderFade,
    reveal: renderReveal,
    "slide-down": renderSlide("y", -1),
    "slide-left": renderSlide("x", -1),
    "slide-right": renderSlide("x", 1),
    "slide-up": renderSlide("y", 1),
};

const resolvePhase = (show: boolean, progress: number): TransitionPhase => {
    if (show) {
        return progress >= 1 ? "entered" : "entering";
    }

    return progress <= 0 ? "exited" : "exiting";
};

type TransitionComponent = ((props: Props) => ReactElement | null) & { isAnimatable: true };

/**
 * Animate a child's entry and exit using a TUI-friendly preset. Drive via
 * `show`; the component toggles between enter and exit, fires `onExit` once
 * the exit animation completes.
 *
 * **Fade preset note:** `dimColor` is only applied when the child is a plain
 * string. Non-string children (Box trees, other components) pass through
 * untouched during the transition — wrap them in `&lt;Text>` if you need the
 * fade effect.
 * @returns A `ReactElement` rendering the transitioning child, or `null`
 * once a hidden transition has fully completed.
 */
function Transition({ children, distance = 4, duration = 240, onExit, preset = "fade", show = true, tickInterval = 30 }: Props): ReactElement | null {
    const [progress, setProgress] = useState(show ? 1 : 0);
    const targetRef = useRef<0 | 1>(show ? 1 : 0);
    const startRef = useRef(Date.now());
    const startProgressRef = useRef(show ? 1 : 0);
    const completedRef = useRef(!show);
    const onExitRef = useRef(onExit);

    onExitRef.current = onExit;

    // Restart animation whenever `show` flips. The `animationKey` state forces
    // the interval-owning effect to re-fire without depending on `progress`.
    // eslint-disable-next-line react-x/no-unused-state -- animationKey is read inside the interval-owning effect via closure
    const [animationKey, setAnimationKey] = useState(0);

    useEffect(() => {
        const target = show ? 1 : 0;

        if (targetRef.current === target) {
            return;
        }

        targetRef.current = target;
        startRef.current = Date.now();
        startProgressRef.current = progress;
        completedRef.current = false;
        // eslint-disable-next-line react-x/set-state-in-effect, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change -- animation restart key must bump in effect when `show` flips; doing it in render would re-trigger every tick
        setAnimationKey((previous) => previous + 1);
        // `progress` is intentionally excluded — it would retrigger the
        // animation on every tick. We snapshot it once when `show` flips.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    // Single interval owner. Runs while the animation is in progress and
    // tears itself down once we reach the target. Crucially does NOT depend
    // on `progress`, so each tick's setState does not rebuild the timer.
    useEffect(() => {
        const target = targetRef.current;

        if (startProgressRef.current === target) {
            if (target === 0 && !completedRef.current) {
                completedRef.current = true;
                onExitRef.current?.();
            }

            return undefined;
        }

        const id = setInterval(() => {
            const elapsed = Date.now() - startRef.current;
            const ratio = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
            const next = startProgressRef.current + (target - startProgressRef.current) * ratio;

            setProgress(next);

            if (ratio >= 1) {
                clearInterval(id);

                if (target === 0 && !completedRef.current) {
                    completedRef.current = true;
                    onExitRef.current?.();
                }
            }
        }, tickInterval);

        return () => {
            clearInterval(id);
        };
    }, [animationKey, duration, tickInterval]);

    const phase = resolvePhase(show, progress);

    if (phase === "exited" && !show) {
        return null;
    }

    const renderer = PRESET_RENDERERS[preset];

    return renderer(progress, children, distance);
}

/**
 * Static marker used by `AnimatePresence` to recognize Transition children
 * even when the consumer hasn't explicitly passed a `show` prop. Consumers
 * can apply the same marker to their own wrappers (`MyWrapper.isAnimatable
 * = true`) to opt them into animation orchestration.
 */
const TransitionWithMarker: TransitionComponent = Object.assign(Transition, { isAnimatable: true as const });

export default TransitionWithMarker;
