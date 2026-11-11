/* eslint-disable import/no-extraneous-dependencies */
import { describe, test } from "vitest";

import { validationCases, validationVariedCases } from "./cases";
import { adapters, OURS } from "./libs";

describe("parse", () => {
    for (const [name, run] of Object.entries(adapters.parsing)) {
        const register = name === OURS ? test : test.skipIf(Boolean(process.env.CODSPEED_ENV));

        register(name, async ({ bench }) => {
            await bench(name, () => {
                for (const cron of validationCases) {
                    run(cron);
                }
            }).run();
        });
    }
});

describe("parse (varied expressions, defeats memoisation)", () => {
    for (const [name, run] of Object.entries(adapters.parsing)) {
        const register = name === OURS ? test : test.skipIf(Boolean(process.env.CODSPEED_ENV));
        let index = 0;

        register(name, async ({ bench }) => {
            await bench(name, () => {
                run(validationVariedCases[index % validationVariedCases.length] as string);
                index += 1;
            }).run();
        });
    }
});
