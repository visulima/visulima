import { CronExpressionParser as Upstream } from "cron-parser";
import { describe, expect, it } from "vitest";

import { parse } from "../src";
import { seededRandom } from "../src/utils/random";
import { clockChangesBetween, DAY, HOUR } from "./_helpers/clock-changes";

/**
 * Compares this package against the reference implementation it was derived from, across zones with
 * every kind of DST oddity: 30 and 45 minute shifts, a skipped calendar day, transitions at midnight,
 * negative DST and zones that changed rules. Start instants are aimed at the real transitions.
 */
const ZONES = [
    "UTC",
    "America/New_York",
    "Europe/London",
    "Europe/Athens",
    "Australia/Lord_Howe",
    "America/Santiago",
    "Pacific/Apia",
    "Asia/Kathmandu",
    "America/Sao_Paulo",
    "Antarctica/Troll",
    "Pacific/Chatham",
    "America/St_Johns",
    "Africa/Casablanca",
];

const FIXED_EXPRESSIONS = [
    "* * * * *",
    "*/5 * * * *",
    "0 * * * *",
    "30 2 * * *",
    "0 0 * * *",
    "15 1,2,3 * * *",
    "0 */2 * * *",
    "0 0 1 * *",
    "0 12 * * 1-5",
    "0 0 L * *",
    "0 9 * * 5L",
    "0 9 * * 1#2",
    "*/10 0-3 * * *",
    "0 0 * 3,10 *",
    "0 0 15 * 1",
    "*/20 * * * * *",
    "0 59 23 * * *",
    "@daily",
    "@hourly",
    "0 30 */6 * * *",
];

const randomExpressions = (count: number): string[] => {
    const random = seededRandom("cron-parser differential expressions");
    const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)] as T;
    const field = (max: number, min = 0): string => {
        const a = min + Math.floor(random() * (max - min + 1));
        const b = Math.min(max, a + Math.floor(random() * 6));

        return pick([
            "*",
            String(a),
            `${String(a)}-${String(b)}`,
            `*/${String(1 + Math.floor(random() * 7))}`,
            `${String(a)},${String(b)}`,
            `${String(a)}-${String(b)}/2`,
        ]);
    };

    return Array.from(
        { length: count },
        () =>
            `${pick(["0", "*/30", "15"])} ${field(59)} ${field(23)} ${pick(["*", "*", field(28, 1)])} ${pick(["*", "*", field(12, 1)])} ${pick(["*", "*", field(6)])}`,
    );
};

const usingPolyfill = "Temporal" in globalThis;

/** Instants spread over 2020 to 2026 that are at least two days clear of every clock change. */
const startsFor = (zoneName: string, transitions: number[]): number[] => {
    const random = seededRandom(zoneName);
    const starts: number[] = [];

    while (starts.length < 12) {
        const start = Date.UTC(2020, 0, 1) + Math.floor(random() * 6 * 365 * DAY);

        if (transitions.every((transition) => Math.abs(transition - start) > 2 * DAY)) {
            starts.push(start);
        }
    }

    return starts;
};

type Schedule = { next: () => { toISOString: () => string | null }; prev: () => { toISOString: () => string | null } };

type Outcome = { dates: string[]; error?: string };

/** The next and previous five runs, or the error message that stopped them. */
const run = (schedule: (expression: string, options: { currentDate: Date; tz: string }) => Schedule, expression: string, tz: string, start: number): Outcome => {
    try {
        const interval = schedule(expression, { currentDate: new Date(start), tz });
        const forward = Array.from({ length: 5 }, () => interval.next().toISOString() as string);
        const backward = Array.from({ length: 5 }, () => interval.prev().toISOString() as string);

        return { dates: [...forward, ...backward] };
    } catch (error) {
        return { dates: [], error: (error as Error).message };
    }
};

/**
 * Away from clock changes the two implementations have to agree exactly. Close to one (two days either side of
 * the start or of any run) they are allowed to differ, because the reference implementation gets several of
 * those wrong; `dst-oracle.test.ts` and `regressions.test.ts` are what judge them there.
 */
const expressions = [...FIXED_EXPRESSIONS, ...randomExpressions(8)];

/** Compares both implementations in a zone, returning the differences nothing near a clock change explains. */
const compareAwayFromClockChanges = (tz: string): { mismatches: string[]; summary: string } => {
    const transitions = clockChangesBetween(tz, Date.UTC(2020, 0, 1), Date.UTC(2027, 0, 1), 6 * HOUR);
    const nearAClockChange = (instant: number): boolean => transitions.some((transition) => Math.abs(transition - instant) <= 2 * DAY);
    const mismatches: string[] = [];
    let compared = 0;
    let judged = 0;

    for (const start of startsFor(tz, transitions)) {
        for (const expression of expressions) {
            const expected = run((value, options) => Upstream.parse(value, options), expression, tz, start);
            const actual = run((value, options) => parse(value, options), expression, tz, start);

            compared += 1;

            if (expected.error === actual.error && expected.dates.join(",") === actual.dates.join(",")) {
                judged += 1;
                continue;
            }

            const instants = [start, ...expected.dates.map((date) => Date.parse(date)), ...actual.dates.map((date) => Date.parse(date))];

            if (!instants.some((instant) => nearAClockChange(instant)) && mismatches.length < 5) {
                mismatches.push(
                    `${expression} @ ${new Date(start).toISOString()}\n  reference ${JSON.stringify(expected)}\n  this      ${JSON.stringify(actual)}`,
                );
            }
        }
    }

    return { mismatches, summary: `${String(mismatches.length)} unexplained differences in ${String(compared)} cases (${String(judged)} identical)` };
};

// Run on the Intl backend only: the polyfilled Temporal backend has its own wrong data for Morocco, and the
// clock change oracle and the ported suite already cover it.
describe.skipIf(usingPolyfill)("differential against the reference implementation", () => {
    it.each(ZONES)("%s agrees wherever no clock change is near", { timeout: 120_000 }, (tz) => {
        expect.assertions(1);

        const { mismatches, summary } = compareAwayFromClockChanges(tz);

        expect(mismatches, summary).toStrictEqual([]);
    });
});
