interface Case {
    cron: string;
    from: Date;
}

/** Expressions and start dates for the scheduling benchmarks. */
const executionCases: Case[] = [
    { cron: "* * * * *", from: new Date("2026-01-15T10:30:00Z") },
    { cron: "0 0 1 * *", from: new Date("2026-01-15T10:00:00Z") },
    { cron: "0 12 31 * *", from: new Date("2026-02-15T10:00:00Z") },
    { cron: "*/15 * * * *", from: new Date("2026-01-15T10:07:00Z") },
    { cron: "0 9 * * *", from: new Date("2026-01-15T10:30:00Z") },
    { cron: "0 9 15 * 1", from: new Date("2026-01-15T10:00:00Z") },
    { cron: "0 9 * * 1-5", from: new Date("2026-01-15T10:00:00Z") },
];

const validationCases: string[] = executionCases.map(({ cron }) => cron);

/** Every minute, hour and day combination, so a library that memoises parsing by string cannot cheat. */
const validationVariedCases: string[] = (() => {
    const expressions: string[] = [];

    for (let day = 1; day <= 31; day += 1) {
        for (let hour = 0; hour < 24; hour += 1) {
            for (let minute = 0; minute < 60; minute += 1) {
                expressions.push(`${String(minute)} ${String(hour)} ${String(day)} * *`);
            }
        }
    }

    return expressions;
})();

export type { Case };
export { executionCases, validationCases, validationVariedCases };
