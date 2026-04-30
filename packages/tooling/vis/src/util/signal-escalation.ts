/**
 * Wall-clock budget enforcement: send SIGTERM when the budget expires,
 * then escalate to SIGKILL after a grace window if the child is still
 * alive.
 *
 * Tasks that ignore SIGTERM (deep child trees on Windows, custom signal
 * handlers, blocked event loops) would otherwise outlive their timeout
 * indefinitely. The escalation guarantees the budget is the upper bound,
 * matching GNU `timeout(1) --kill-after` semantics.
 */

export interface ScheduleTimeoutKillOptions {
    /**
     * Milliseconds to wait between SIGTERM and SIGKILL. `0` disables
     * escalation (SIGTERM only). Defaults to 5000.
     */
    killGracePeriodMs?: number;

    /**
     * Called once when the timeout fires, before any signal is sent.
     * Use this to record `timedOut = true` for downstream reporting.
     */
    onTimeout?: () => void;

    /**
     * Called with the signal to send. Typically a thin wrapper around
     * the per-process `kill` callback emitted by the task runner's
     * `started` event.
     */
    sendSignal: (signal: "SIGKILL" | "SIGTERM") => void;
    /** Wall-clock budget. `&lt;= 0` disables the watchdog entirely. */
    timeoutMs: number;
}

export interface TimeoutKillHandle {
    /**
     * Cancel any pending SIGTERM/SIGKILL timers. Always call this from
     * the task's `finally` block, even on success — otherwise a
     * scheduled SIGKILL could leak into the next process group.
     */
    cancel: () => void;
}

/**
 * Schedules the SIGTERM → SIGKILL escalation. Returns a handle whose
 * `cancel()` MUST be called when the task ends so the kill timers
 * don't leak across runs.
 *
 * The returned handle is a no-op when `timeoutMs &lt;= 0`, so callers can
 * unconditionally schedule and cancel without branching on the budget.
 */
export const scheduleTimeoutKill = (options: ScheduleTimeoutKillOptions): TimeoutKillHandle => {
    const { killGracePeriodMs: rawKillGracePeriodMs = 5000, onTimeout, sendSignal, timeoutMs } = options;

    if (timeoutMs <= 0) {
        return { cancel: () => {} };
    }

    // Negative grace windows make no sense. Treat them as "skip
    // escalation" rather than throwing, since this helper runs deep
    // inside the executor and a thrown error here would mask the
    // task failure that motivated the timeout in the first place.
    const killGracePeriodMs = Math.max(rawKillGracePeriodMs, 0);

    let escalationHandle: NodeJS.Timeout | undefined;

    const timeoutHandle = setTimeout(() => {
        onTimeout?.();
        sendSignal("SIGTERM");

        if (killGracePeriodMs > 0) {
            escalationHandle = setTimeout(() => {
                sendSignal("SIGKILL");
            }, killGracePeriodMs);
        }
    }, timeoutMs);

    return {
        cancel: () => {
            clearTimeout(timeoutHandle);

            if (escalationHandle) {
                clearTimeout(escalationHandle);
            }
        },
    };
};
