/* eslint-disable import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

import { validationCases, validationVariedCases } from "./cases";
import { adapters, OURS } from "./libs";

describe("parse", () => {
    for (const [name, run] of Object.entries(adapters.parsing)) {
        const register = name === OURS ? bench : bench.skipIf(Boolean(process.env.CODSPEED_ENV));

        register(name, () => {
            for (const cron of validationCases) {
                run(cron);
            }
        });
    }
});

describe("parse (varied expressions, defeats memoisation)", () => {
    for (const [name, run] of Object.entries(adapters.parsing)) {
        const register = name === OURS ? bench : bench.skipIf(Boolean(process.env.CODSPEED_ENV));
        let index = 0;

        register(name, () => {
            run(validationVariedCases[index % validationVariedCases.length] as string);
            index += 1;
        });
    }
});
