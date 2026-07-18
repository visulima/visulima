import { Cron } from "croner";

import WorkflowError from "./errors";
import type { Duration, DurationUnit } from "./types";

const UNIT_MS: Record<DurationUnit, number> = {
    days: 86_400_000,
    hours: 3_600_000,
    milliseconds: 1,
    minutes: 60_000,
    ms: 1,
    seconds: 1000,
    weeks: 604_800_000,
};

/**
 * Resolve a {@link Duration} to an absolute wake-at epoch millisecond, relative
 * to `from`. Cron durations resolve to the next matching occurrence after `from`.
 * @param duration The duration to resolve.
 * @param from The reference time in epoch ms (defaults to `Date.now()`).
 * @returns The absolute wake-at timestamp in epoch ms.
 */
const resolveWakeAt = (duration: Duration, from: number = Date.now()): number => {
    if (typeof duration === "number") {
        if (!Number.isFinite(duration)) {
            throw new WorkflowError("invalid-duration", `Duration must be a finite number of milliseconds. Received: ${String(duration)}.`);
        }

        return from + Math.max(0, duration);
    }

    if ("cron" in duration) {
        const next = new Cron(duration.cron, duration.tz ? { timezone: duration.tz } : {}).nextRun(new Date(from));

        if (next === null) {
            throw new WorkflowError("invalid-cron", `Cron expression "${duration.cron}" has no future occurrence.`);
        }

        return next.getTime();
    }

    if (!Number.isFinite(duration.amount)) {
        throw new WorkflowError("invalid-duration", `Duration amount must be a finite number. Received: ${String(duration.amount)}.`);
    }

    const factor = UNIT_MS[duration.unit];

    if (factor === undefined) {
        throw new WorkflowError("invalid-duration", `Duration unit must be one of ${Object.keys(UNIT_MS).join(", ")}. Received: ${String(duration.unit)}.`);
    }

    return from + Math.max(0, duration.amount) * factor;
};

export default resolveWakeAt;
