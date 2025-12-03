import { dirname, isAbsolute, resolve, sep } from "node:path";

import { up } from "empathic/walk";
// eslint-disable-next-line import/no-extraneous-dependencies
import { bench, describe } from "vitest";

import visulimaWalk from "../src/find/walk";
import visulimaWalkSync from "../src/find/walk-sync";

const start = "fixtures/a/b/c/d/e/f/g/h/i/j/start.txt";

const absolute = (input: string, root?: string): string => (isAbsolute(input) ? input : resolve(root || ".", input));

const alt1 = (base: string): string[] => {
    let previous = absolute(base);
    let temporary = dirname(previous);
    const array: string[] = [];

    while (true) {
        array.push(temporary);
        previous = temporary;
        temporary = dirname(previous);

        if (temporary === previous) {
            return array;
        }
    }
};

const split1 = (input: string): string[] => {
    const array = (isAbsolute(input) ? input : resolve(input)).split(sep);
    let index = 0;
    const { length } = array;
    const output = Array.from<string>({ length });

    for (; index < length; index += 1) {
        output[index] = array.slice(0, length - index).join(sep);
    }

    return output;
};

const split2 = (input: string): string[] => {
    const output: string[] = [];
    const base = isAbsolute(input) ? input : resolve(input);

    const rgx = new RegExp(`[${sep}]+`, "g");
    let match: RegExpExecArray | null = rgx.exec(base);

    while (match !== null) {
        output.push(base.slice(0, match.index) || "/");
        match = rgx.exec(base);
    }

    return output.toReversed();
};

const split3 = (input: string): string[] => {
    const base = isAbsolute(input) ? input : resolve(input);
    let { length } = base;
    const output: string[] = [];

    while (length > 0) {
        length -= 1;

        if (base.codePointAt(length) === 47) {
            output.push(base.slice(0, length) || "/");
        }
    }

    return output;
};

const split4 = (input: string): string[] => {
    const base = isAbsolute(input) ? input : resolve(input);
    let { length } = base;
    const output: string[] = [];

    while (length > 0) {
        length -= 1;

        if (base.charAt(length) === sep) {
            output.push(base.slice(0, length) || sep);
        }
    }

    return output;
};

describe("walk.up and split variants", () => {
    bench("empathic/walk.up (no options)", () => {
        let total = 0;

        for (const _ of alt1(start)) {
            total += 1;
        }
    });

    bench("empathic/walk.up", () => {
        let total = 0;

        for (const _ of up(start)) {
            total += 1;
        }
    });

    bench("@visulima/fs walk", async () => {
        let total = 0;

        for await (const _ of visulimaWalk(dirname(start), {})) {
            total += 1;
        }
    });

    bench("@visulima/fs walk-sync", () => {
        let total = 0;

        for (const _ of visulimaWalkSync(dirname(start), {})) {
            total += 1;
        }
    });

    bench("split1", () => {
        let total = 0;

        for (const _ of split1(start)) {
            total += 1;
        }
    });

    bench("split2", () => {
        let total = 0;

        for (const _ of split2(start)) {
            total += 1;
        }
    });

    bench("split3", () => {
        let total = 0;

        for (const _ of split3(start)) {
            total += 1;
        }
    });

    bench("split4", () => {
        let total = 0;

        for (const _ of split4(start)) {
            total += 1;
        }
    });
});
