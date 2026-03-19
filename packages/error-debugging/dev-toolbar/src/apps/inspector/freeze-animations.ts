/**
 * Freeze Animations — comprehensive animation/timer freeze system.
 *
 * Monkey-patches setTimeout, setInterval, and requestAnimationFrame so that
 * callbacks are silently queued while frozen. Also injects CSS to pause
 * CSS animations/transitions, pauses WAAPI animations, and pauses videos.
 *
 * Patches are installed as a side effect of importing this module.
 * Toolbar/popup code must import `originalSetTimeout` to bypass the patch.
 *
 * Based on agentation's freeze-animations.ts pattern.
 */

// Exclude selectors — dev-toolbar UI elements should never be frozen
const EXCLUDE_ATTRS = ["id^='__vdt_'", "class*='__vdt_'"];
const NOT_SELECTORS = EXCLUDE_ATTRS
    .flatMap((a) => [`:not([${a}])`, `:not([${a}] *)`])
    .join("");

const STYLE_ID = "__vdt_freeze_styles";
const STATE_KEY = "__vdt_freeze_state";

// ─── Shared mutable state on window (survives HMR) ──────────────────────────

interface FreezeState {
    frozen: boolean;
    frozenRAFQueue: FrameRequestCallback[];
    frozenTimeoutQueue: Array<() => void>;
    installed: boolean;
    origRAF: typeof requestAnimationFrame;
    origSetInterval: typeof setInterval;
    origSetTimeout: typeof setTimeout;
    pausedAnimations: Animation[];
}

const getState = (): FreezeState => {
    if (typeof window === "undefined") {
        return {
            frozen: false,
            frozenRAFQueue: [],
            frozenTimeoutQueue: [],
            installed: true, // prevent patching on server
            origRAF: (() => 0) as unknown as typeof requestAnimationFrame,
            origSetInterval: (() => 0) as unknown as typeof setInterval,
            origSetTimeout: (() => 0) as unknown as typeof setTimeout,
            pausedAnimations: [],
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;

    if (!w[STATE_KEY]) {
        w[STATE_KEY] = {
            frozen: false,
            frozenRAFQueue: [],
            frozenTimeoutQueue: [],
            installed: false,
            origRAF: null,
            origSetInterval: null,
            origSetTimeout: null,
            pausedAnimations: [],
        };
    }

    return w[STATE_KEY] as FreezeState;
};

const _s = getState();

// ─── Install patches (once — survives HMR) ──────────────────────────────────

if (typeof window !== "undefined" && !_s.installed) {
    _s.origSetTimeout = window.setTimeout.bind(window);
    _s.origSetInterval = window.setInterval.bind(window);
    _s.origRAF = window.requestAnimationFrame.bind(window);

    // Patch setTimeout — queue callback when frozen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).setTimeout = (handler: TimerHandler, timeout?: number, ...args: unknown[]): ReturnType<typeof setTimeout> => {
        if (typeof handler === "string") {
            return _s.origSetTimeout(handler, timeout);
        }

        return _s.origSetTimeout(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (...a: any[]) => {
                if (_s.frozen) {
                    _s.frozenTimeoutQueue.push(() => (handler as Function)(...a));
                } else {
                    (handler as Function)(...a);
                }
            },
            timeout,
            ...args,
        );
    };

    // Patch setInterval — skip callback when frozen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).setInterval = (handler: TimerHandler, timeout?: number, ...args: unknown[]): ReturnType<typeof setInterval> => {
        if (typeof handler === "string") {
            return _s.origSetInterval(handler, timeout);
        }

        return _s.origSetInterval(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (...a: any[]) => {
                if (!_s.frozen) {
                    (handler as Function)(...a);
                }
            },
            timeout,
            ...args,
        );
    };

    // Patch requestAnimationFrame — queue when frozen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).requestAnimationFrame = (callback: FrameRequestCallback): number => {
        return _s.origRAF((timestamp: number) => {
            if (_s.frozen) {
                _s.frozenRAFQueue.push(callback);
            } else {
                callback(timestamp);
            }
        });
    };

    _s.installed = true;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/** Original (unpatched) setTimeout — use for toolbar/popup animations */
export const originalSetTimeout: typeof setTimeout = _s.origSetTimeout;

/** Whether animations are currently frozen */
export const isFrozen = (): boolean => _s.frozen;

/** Freeze all animations, timers, and videos */
export const freezeAll = (): void => {
    if (typeof document === "undefined" || _s.frozen) {
        return;
    }

    _s.frozen = true;
    _s.frozenTimeoutQueue = [];
    _s.frozenRAFQueue = [];

    // CSS injection — pause animations and kill transitions
    let style = document.getElementById(STYLE_ID);

    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
    }

    style.textContent = `
        *${NOT_SELECTORS},
        *${NOT_SELECTORS}::before,
        *${NOT_SELECTORS}::after {
            animation-play-state: paused !important;
            transition: none !important;
        }
    `;
    document.head.append(style);

    // WAAPI — pause only RUNNING non-toolbar animations
    _s.pausedAnimations = [];

    try {
        for (const anim of document.getAnimations()) {
            if (anim.playState !== "running") {
                continue;
            }

            const target = (anim.effect as KeyframeEffect)?.target as Element | null;

            if (target && !target.closest?.("[id^='__vdt_']") && !target.closest?.("dev-toolbar")) {
                anim.pause();
                _s.pausedAnimations.push(anim);
            }
        }
    } catch {
        // getAnimations may not be available
    }

    // Pause videos
    for (const video of document.querySelectorAll("video")) {
        if (!video.paused) {
            video.dataset.wasPaused = "false";
            video.pause();
        }
    }
};

/** Unfreeze — resume everything and replay queued callbacks */
export const unfreezeAll = (): void => {
    if (typeof document === "undefined" || !_s.frozen) {
        return;
    }

    _s.frozen = false;

    // Replay queued setTimeout callbacks asynchronously
    const timeoutQueue = _s.frozenTimeoutQueue;

    _s.frozenTimeoutQueue = [];

    for (const cb of timeoutQueue) {
        _s.origSetTimeout(() => {
            if (_s.frozen) {
                _s.frozenTimeoutQueue.push(cb);

                return;
            }

            try {
                cb();
            } catch {
                // ignore replay errors
            }
        }, 0);
    }

    // Replay queued rAF callbacks
    const rafQueue = _s.frozenRAFQueue;

    _s.frozenRAFQueue = [];

    for (const cb of rafQueue) {
        _s.origRAF((ts: number) => {
            if (_s.frozen) {
                _s.frozenRAFQueue.push(cb);

                return;
            }

            cb(ts);
        });
    }

    // WAAPI — resume BEFORE removing CSS (prevents animation replacement)
    for (const anim of _s.pausedAnimations) {
        try {
            anim.play();
        } catch {
            // ignore resume errors
        }
    }

    _s.pausedAnimations = [];

    // Now remove CSS injection
    document.getElementById(STYLE_ID)?.remove();

    // Resume videos
    for (const video of document.querySelectorAll<HTMLVideoElement>("video[data-was-paused='false']")) {
        video.play().catch(() => {});
        delete video.dataset.wasPaused;
    }
};

/** Toggle freeze state */
export const toggleFreeze = (): boolean => {
    if (_s.frozen) {
        unfreezeAll();

        return false;
    }

    freezeAll();

    return true;
};
