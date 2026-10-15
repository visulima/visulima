/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

import { executionCases } from "./cases";
import { adapters, OURS } from "./libs";

for (const { cron, from } of executionCases) {
    describe(`previousRun: ${cron}`, () => {
        for (const [name, run] of Object.entries(adapters.previousRun)) {
            const register = name === OURS ? bench : bench.skipIf(Boolean(process.env.CODSPEED_ENV));

            register(name, () => {
                run(cron, from);
            });
        }
    });
}
