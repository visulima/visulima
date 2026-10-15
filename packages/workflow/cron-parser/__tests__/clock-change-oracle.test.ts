import { describe, expect, it } from "vitest";

import { CronExpressionParser } from "../src";
import type { CronExpression } from "../src/cron-expression";
import { getZone } from "../src/zone";
import { clockChangesBetween, DAY, HOUR, MINUTE } from "./_helpers/clock-changes";

/**
 * Checks `next()` and `prev()` against a brute-force model of the clock-change rules, built without any of the
 * engine's wall clock mapping, and reading the zone's raw offsets rather than the engine's remembered ones. The model scans the zone minute by minute around a transition and inverts the clock: every
 * real minute is filed under the wall clock time it shows, so a wall time ends up with no instants (a gap), one,
 * or two (an overlap). Runs are then read straight off that table. A wall time that matches the expression and
 * exists once is a run. One that exists twice is a run at both passes for an every-hour expression and at the
 * earlier pass otherwise. One that does not exist runs, for an expression that names its hours, at the same minute
 * of the first hour after the gap, unless the gap is a whole day or more.
 */
type Case = { expression: string; hours: number[] | "*"; minutes: number[] };

const EVERY_MINUTE = Array.from({ length: 60 }, (_, minute) => minute);

const CASES: Case[] = [
    { expression: "* * * * *", hours: "*", minutes: EVERY_MINUTE },
    { expression: "0 * * * *", hours: "*", minutes: [0] },
    { expression: "*/15 * * * *", hours: "*", minutes: [0, 15, 30, 45] },
    { expression: "30 * * * *", hours: "*", minutes: [30] },
    { expression: "30 1 * * *", hours: [1], minutes: [30] },
    { expression: "0 2 * * *", hours: [2], minutes: [0] },
    { expression: "0 3 * * *", hours: [3], minutes: [0] },
    { expression: "45 2 * * *", hours: [2], minutes: [45] },
    { expression: "15 1,2,3 * * *", hours: [1, 2, 3], minutes: [15] },
    { expression: "*/20 2 * * *", hours: [2], minutes: [0, 20, 40] },
    { expression: "0 0 * * *", hours: [0], minutes: [0] },
    { expression: "59 23 * * *", hours: [23], minutes: [59] },
    { expression: "0 12 * * *", hours: [12], minutes: [0] },
    { expression: "* 1 * * *", hours: [1], minutes: EVERY_MINUTE },
];

/**
 * A stretch of time to scan for clock changes. `step` is how finely the model scans: a minute, or a second for
 * zones whose offset has seconds in it. `sparse` leaves out the every-minute expressions, which across a day-long
 * gap only walk minutes that cannot run.
 */
type Window = { from: number; sparse?: boolean; step?: number; to: number; zone: string };

type Gap = { end: number; start: number; transition: number };

type Model = { gaps: Gap[]; instantsByWall: Map<number, number[]> };

/** Each instant in a window filed under the wall clock time it shows, and the stretches of wall time that never show. */
const buildModel = (zoneName: string, from: number, to: number, step: number): Model => {
    const zone = getZone(zoneName);
    const instantsByWall = new Map<number, number[]>();
    const gaps: Gap[] = [];
    let previousWall: number | undefined;

    for (let instant = from; instant <= to; instant += step) {
        const wall = instant + zone.rawOffset(instant) * MINUTE;

        const known = instantsByWall.get(wall) ?? [];

        instantsByWall.set(wall, [...known, instant]);

        // The wall clock jumping forward by more than a step marks a gap: the walls in between never show.
        if (previousWall !== undefined && wall - previousWall > step) {
            gaps.push({ end: wall, start: previousWall + step, transition: instant });
        }

        previousWall = wall;
    }

    return { gaps, instantsByWall };
};

const matchesCase = (testCase: Case, wall: number): boolean => {
    const date = new Date(wall);

    const onTheMinute = date.getUTCSeconds() === 0 && testCase.minutes.includes(date.getUTCMinutes());
    const inTheHour = testCase.hours === "*" || testCase.hours.includes(date.getUTCHours());

    return onTheMinute && inTheHour;
};

/** Runs at wall times that exist: all of them for an every-hour expression, the earlier pass otherwise. */
const runsAtExistingTimes = (testCase: Case, model: Model): number[] => {
    const runs: number[] = [];

    for (const [wall, instants] of model.instantsByWall) {
        if (matchesCase(testCase, wall)) {
            const chosen = testCase.hours === "*" ? instants : [instants[0] as number];

            runs.push(...chosen);
        }
    }

    return runs;
};

/** Runs for wall times that never happened: the same minute of the first hour after a gap shorter than a day. */
const runsForSkippedTimes = (testCase: Case, model: Model, step: number): number[] => {
    const runs: number[] = [];

    for (const gap of model.gaps.filter(({ end, start }) => end - start < DAY - step)) {
        for (let wall = gap.start; wall < gap.end; wall += step) {
            if (matchesCase(testCase, wall)) {
                runs.push(gap.transition + ((wall - gap.start) % HOUR));
            }
        }
    }

    return runs;
};

/** All runs of a case inside the window, in time order. */
const modelRuns = (testCase: Case, model: Model, from: number, to: number, step: number): number[] => {
    const skipped = testCase.hours === "*" ? [] : runsForSkippedTimes(testCase, model, step);
    const runs = new Set([...runsAtExistingTimes(testCase, model), ...skipped]);

    return [...runs].filter((run) => run >= from && run <= to).toSorted((a, b) => a - b);
};

const MODERN_ZONES = [
    "America/New_York",
    "Europe/London",
    "Europe/Athens",
    "Australia/Lord_Howe",
    "America/Santiago",
    "Antarctica/Troll",
    "Pacific/Chatham",
    "America/St_Johns",
    "Africa/Casablanca",
    "America/Sao_Paulo",
    "Asia/Kathmandu",
];

const WINDOWS: Window[] = [
    ...MODERN_ZONES.map((zone) => {
        return { from: Date.UTC(2022, 0, 1), to: Date.UTC(2023, 0, 1), zone };
    }),
    // Samoa dropped 30 December 2011 entirely: a 24 hour gap.
    { from: Date.UTC(2011, 11, 25), sparse: true, to: Date.UTC(2012, 0, 5), zone: "Pacific/Apia" },
    // Manila's pre-1845 offset was -15:56:08, and it skipped 31 December 1844. Scanned by the second.
    { from: Date.UTC(1844, 11, 29), sparse: true, step: 1000, to: Date.UTC(1845, 0, 3), zone: "Asia/Manila" },
    // Troll's clocks jump two hours (01:00 -> 03:00).
    { from: Date.UTC(2026, 2, 20), to: Date.UTC(2026, 3, 5), zone: "Antarctica/Troll" },
];

// The polyfilled Temporal backend is several times slower, so it checks a representative subset.
const polyfilled = "Temporal" in globalThis;
const SUBSET = new Set(["Africa/Casablanca", "America/New_York", "Australia/Lord_Howe", "Pacific/Apia", "Pacific/Chatham"]);

/** Cursors dense around the change and sparse further out, plus runs exactly, a millisecond early and half a second late. */
const cursorsAround = (transition: number, runs: number[]): Set<number> => {
    const cursors = new Set<number>();

    for (let cursor = transition - 3 * HOUR; cursor <= transition + 3 * HOUR; cursor += Math.abs(cursor - transition) < 75 * MINUTE ? MINUTE : 7 * MINUTE) {
        cursors.add(cursor);
    }

    // Every run for sparse expressions; for a dense one, a sample.
    for (const [index, run] of runs.entries()) {
        if (Math.abs(run - transition) < 3 * HOUR && (runs.length < 200 || index % 9 === 0)) {
            cursors.add(run);
            cursors.add(run - 1);
            cursors.add(run + 500);
        }
    }

    return cursors;
};

const attempt = (move: () => { getTime: () => number }): number | undefined => {
    try {
        return move().getTime();
    } catch {
        return undefined;
    }
};

const describeInstant = (instant: number | undefined): string => {
    if (instant === undefined) {
        return "none";
    }

    return new Date(instant).toISOString();
};

/** Where `next()` and `prev()` from a cursor disagree with the model. An answer outside the modelled window is not judged. */
const disagreements = (testCase: Case, interval: CronExpression, runs: number[], cursor: number, judged: { from: number; to: number }): string[] => {
    const expected = { next: runs.find((run) => run > cursor), prev: runs.findLast((run) => run < cursor) };

    interval.reset(new Date(cursor));

    const nextActual = attempt(() => interval.next());

    interval.reset(new Date(cursor));

    const actual = { next: nextActual, prev: attempt(() => interval.prev()) };

    return (["next", "prev"] as const)
        .filter((direction) => {
            const wanted = expected[direction];

            return wanted !== undefined && wanted > judged.from && wanted < judged.to && wanted !== actual[direction];
        })
        .map(
            (direction) =>
                `${testCase.expression} ${direction} from ${describeInstant(cursor)}: expected ${describeInstant(expected[direction])}, got ${describeInstant(actual[direction])}`,
        );
};

const windowsToCheck = polyfilled ? WINDOWS.filter(({ zone }) => SUBSET.has(zone)) : WINDOWS;

describe("next and prev against a brute-force model of the clock-change rules", () => {
    it.each(windowsToCheck)("$zone from $from", { timeout: 180_000 }, (window) => {
        expect.assertions(1);

        const step = window.step ?? MINUTE;
        const span = window.step === undefined ? 3 * DAY : 2.5 * DAY;
        const cases = window.sparse ? CASES.filter(({ minutes }) => minutes.length < 5) : CASES;
        const failures: string[] = [];
        let checked = 0;

        for (const transition of clockChangesBetween(window.zone, window.from, window.to, HOUR / 2)) {
            const from = transition - span;
            const to = transition + span;
            const model = buildModel(window.zone, from, to, step);

            for (const testCase of cases) {
                const runs = modelRuns(testCase, model, from, to, step);
                const interval = CronExpressionParser.parse(testCase.expression, { tz: window.zone });

                for (const cursor of cursorsAround(transition, runs)) {
                    checked += 1;
                    failures.push(...disagreements(testCase, interval, runs, cursor, { from: from + DAY, to: to - DAY }));
                }
            }
        }

        expect(failures.slice(0, 6), `${window.zone}: ${String(checked)} cursors checked`).toStrictEqual([]);
    });
});
