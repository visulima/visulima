/* eslint-disable import/no-extraneous-dependencies */
import { describe, test } from "vitest";

import { executionCases } from "./cases";
import { adapters, OURS } from "./libs";

for (const { cron, from } of executionCases) {
    describe(`next 100 runs: ${cron}`, () => {
        for (const [name, run] of Object.entries(adapters.nextRuns)) {
            const register = name === OURS ? test : test.skipIf(Boolean(process.env.CODSPEED_ENV));

            register(name, async ({ bench }) => {
                await bench(name, () => {
                    run(cron, from);
                }).run();
            });
        }
    });
}
