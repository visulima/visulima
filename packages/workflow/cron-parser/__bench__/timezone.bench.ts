/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

import { adapters, OURS } from "./libs";

const zones = ["America/New_York", "Europe/Berlin", "Australia/Lord_Howe"];

// 2026-03-07 is the day before the US spring-forward, so the run spans a DST change.
const from = new Date("2026-03-07T00:00:00Z");

for (const tz of zones) {
    describe(`next 30 daily runs in ${tz}`, () => {
        for (const [name, run] of Object.entries(adapters.timezone)) {
            const register = name === OURS ? bench : bench.skipIf(Boolean(process.env.CODSPEED_ENV));

            register(name, () => {
                run("0 9 * * *", from, tz);
            });
        }
    });
}
