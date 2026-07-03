/* eslint-disable consistent-return, unicorn/prefer-ternary */

/**
 * React hook for macOS-style scroll acceleration with momentum.
 *
 * Tracks scroll event velocity and applies exponential acceleration
 * when events arrive rapidly, with smooth deceleration (coasting).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UseScrollAccelerationOptions = {
    /**
     * Velocity multiplier per rapid scroll event.
     * @default 1.5
     */
    readonly acceleration?: number;

    /**
     * Velocity decay factor per tick (0-1). Lower = faster stop.
     * @default 0.92
     */
    readonly decayRate?: number;

    /**
     * Enable or disable acceleration.
     * @default true
     */
    readonly isActive?: boolean;

    /**
     * Maximum velocity in lines per tick.
     * @default 20
     */
    readonly maxVelocity?: number;

    /**
     * Callback invoked with the scroll delta (signed integer lines) on each tick.
     */
    readonly onScroll?: (delta: number) => void;
};

export type UseScrollAccelerationResult = {
    /** Handle a discrete scroll event (from mouse wheel or keyboard). */
    readonly handleScroll: (direction: "down" | "up") => void;
    /** Whether momentum is still active (coasting after last input). */
    readonly isCoasting: boolean;
    /** Current velocity (positive = down, negative = up). */
    readonly velocity: number;
};

const RAPID_THRESHOLD_MS = 100;
const TICK_INTERVAL_MS = 16; // ~60fps
const MIN_VELOCITY = 0.5;

/**
 * Hook providing scroll acceleration with momentum physics.
 *
 * ```tsx
 * const { handleScroll } = useScrollAcceleration({
 *     onScroll: (delta) => scrollViewRef.current?.scrollBy(delta),
 * });
 *
 * useMouseAction(); // call handleScroll("up") or handleScroll("down") on scroll events
 * ```
 */
const useScrollAcceleration = (options: UseScrollAccelerationOptions = {}): UseScrollAccelerationResult => {
    const { acceleration = 1.5, decayRate = 0.92, isActive = true, maxVelocity = 20, onScroll } = options;

    const [velocity, setVelocity] = useState(0);
    const [isCoasting, setIsCoasting] = useState(false);

    const velocityRef = useRef(0);
    const lastScrollTimeRef = useRef(0);
    const skipNextTickRef = useRef(false);
    const tickTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const onScrollRef = useRef(onScroll);

    onScrollRef.current = onScroll;

    // Momentum tick loop — only runs while coasting to avoid idle CPU usage
    useEffect(() => {
        if (!isActive || !isCoasting) {
            return;
        }

        const tick = () => {
            // Skip the first tick after handleScroll to avoid double-emission
            if (skipNextTickRef.current) {
                skipNextTickRef.current = false;

                return;
            }

            const v = velocityRef.current;

            if (Math.abs(v) < MIN_VELOCITY) {
                velocityRef.current = 0;
                setVelocity(0);
                setIsCoasting(false);

                return;
            }

            // Apply decay
            velocityRef.current *= decayRate;

            // Emit scroll delta
            const delta = Math.round(velocityRef.current);

            if (delta !== 0) {
                onScrollRef.current?.(delta);
            }

            setVelocity(velocityRef.current);
        };

        tickTimerRef.current = setInterval(tick, TICK_INTERVAL_MS);

        return () => {
            if (tickTimerRef.current) {
                clearInterval(tickTimerRef.current);
            }
        };
    }, [isActive, isCoasting, decayRate]);

    const handleScroll = useCallback(
        (direction: "down" | "up") => {
            if (!isActive) {
                // No acceleration — just emit a single line scroll
                onScrollRef.current?.(direction === "down" ? 1 : -1);

                return;
            }

            const now = Date.now();
            const elapsed = now - lastScrollTimeRef.current;
            const sign = direction === "down" ? 1 : -1;

            lastScrollTimeRef.current = now;

            if (elapsed < RAPID_THRESHOLD_MS && Math.sign(velocityRef.current) === sign) {
                // Rapid scroll in same direction — accelerate
                velocityRef.current = Math.min(Math.abs(velocityRef.current * acceleration), maxVelocity) * sign;
            } else {
                // New scroll or direction change — reset velocity
                velocityRef.current = sign;
            }

            setVelocity(velocityRef.current);
            setIsCoasting(true);
            skipNextTickRef.current = true;

            // Immediate feedback
            onScrollRef.current?.(sign);
        },
        [isActive, acceleration, maxVelocity],
    );

    return useMemo(() => {
        return { handleScroll, isCoasting, velocity };
    }, [handleScroll, isCoasting, velocity]);
};

export default useScrollAcceleration;

export { useScrollAcceleration };
