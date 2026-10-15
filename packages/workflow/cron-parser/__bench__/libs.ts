import { parse as visulimaParse } from "@visulima/cron-parser";
import { isValid, nextRun as cronFast_nextRun, nextRuns as cronFast_nextRuns, parse, previousRun as cronFast_previousRun } from "cron-fast";
import { CronExpressionParser as CronParser } from "cron-parser";
import { parseCronExpression } from "cron-schedule";
import cronValidateModule from "cron-validate";
import { Cron } from "croner";

const cronValidate = (cronValidateModule as unknown as { default?: typeof cronValidateModule }).default ?? cronValidateModule;

type Adapter<Arguments extends unknown[]> = Record<string, (...arguments_: Arguments) => unknown>;

/** The library this benchmark is about. Competitors are skipped on CodSpeed, which only tracks this one. */
const OURS = "@visulima/cron-parser";

const nextRun: Adapter<[string, Date]> = {
    "cron-fast": (cron, from) => cronFast_nextRun(cron, { from }),
    "cron-parser": (cron, from) => CronParser.parse(cron, { currentDate: from }).next().toDate(),
    "cron-schedule": (cron, from) => parseCronExpression(cron).getNextDate(from),
    croner: (cron, from) => new Cron(cron, { paused: true, startAt: from }).nextRun(from),
    [OURS]: (cron, from) => visulimaParse(cron, { currentDate: from, tz: "UTC" }).next().toDate(),
};

const previousRun: Adapter<[string, Date]> = {
    "cron-fast": (cron, from) => cronFast_previousRun(cron, { from }),
    "cron-parser": (cron, from) => CronParser.parse(cron, { currentDate: from }).prev().toDate(),
    "cron-schedule": (cron, from) => parseCronExpression(cron).getPrevDate(from),
    // No `startAt`: Croner does not look for runs before it, so with `startAt: from` there would be nothing to find.
    croner: (cron, from) => new Cron(cron, { paused: true }).previousRuns(1, from),
    [OURS]: (cron, from) => visulimaParse(cron, { currentDate: from, tz: "UTC" }).prev().toDate(),
};

const nextRuns: Adapter<[string, Date]> = {
    "cron-fast": (cron, from) => cronFast_nextRuns(cron, 100, { from }),
    "cron-parser": (cron, from) => CronParser.parse(cron, { currentDate: from }).take(100),
    "cron-schedule": (cron, from) => parseCronExpression(cron).getNextDates(100, from),
    croner: (cron, from) => new Cron(cron, { paused: true, startAt: from }).nextRuns(100, from),
    [OURS]: (cron, from) => visulimaParse(cron, { currentDate: from, tz: "UTC" }).take(100),
};

/** An invalid expression makes the parsers throw; the benchmark measures that cost too, so it is swallowed here. */
const swallow = (call: () => unknown): unknown => {
    try {
        return call();
    } catch {
        return undefined;
    }
};

const validation: Adapter<[string]> = {
    "cron-fast": (cron) => isValid(cron),
    "cron-parser": (cron) => swallow(() => CronParser.parse(cron)),
    "cron-schedule": (cron) => swallow(() => parseCronExpression(cron)),
    "cron-validate": (cron) => cronValidate(cron),
    croner: (cron) => swallow(() => new Cron(cron, { paused: true })),
    [OURS]: (cron) => swallow(() => visulimaParse(cron)),
};

const parsing: Adapter<[string]> = {
    "cron-fast": (cron) => parse(cron),
    "cron-parser": (cron) => CronParser.parse(cron),
    "cron-schedule": (cron) => parseCronExpression(cron),
    "cron-validate": (cron) => cronValidate(cron),
    croner: (cron) => new Cron(cron, { paused: true }),
    [OURS]: (cron) => visulimaParse(cron),
};

/** The next 30 daily runs from just before a DST change, in a zone that observes it. `cron-schedule` has no zone option. */
const timezone: Adapter<[string, Date, string]> = {
    "cron-fast": (cron, from, tz) => cronFast_nextRuns(cron, 30, { from, timezone: tz }),
    "cron-parser": (cron, from, tz) => CronParser.parse(cron, { currentDate: from, tz }).take(30),
    croner: (cron, from, tz) => new Cron(cron, { paused: true, startAt: from, timezone: tz }).nextRuns(30, from),
    [OURS]: (cron, from, tz) => visulimaParse(cron, { currentDate: from, tz }).take(30),
};

const adapters = { nextRun, nextRuns, parsing, previousRun, timezone, validation };

export { adapters, OURS };
