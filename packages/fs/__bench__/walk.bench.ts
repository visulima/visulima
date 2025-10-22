import { dirname, isAbsolute, resolve, sep } from "node:path";

import { up } from "empathic/walk";
import { bench, describe } from "vitest";

import visulimaWalk from "../src/find/walk";
import visulimaWalkSync from "../src/find/walk-sync";

// let start = ".";
// let start = resolve('fixtures/a/b/c/d/e/f/g/h/i/j/start.txt');
const start = "fixtures/a/b/c/d/e/f/g/h/i/j/start.txt";

const absolute = (input: string, root?: string): string => (isAbsolute(input) ? input : resolve(root || ".", input));

function alt1(base: string) {
    let previous = absolute(base);
    let temporary = dirname(previous);
    const array: string[] = [];

    while (true) {
        array.push(temporary);
        temporary = dirname(previous = temporary);

        if (temporary === previous)
            return array;
    }
}

function split1(input: string) {
    const array = (isAbsolute(input) ? input : resolve(input)).split(sep);
    let index = 0;
    const length_ = array.length;
    const output = new Array<string>(length_);

    for (; index < length_; index++) {
        output[index] = array.slice(0, length_ - index).join(sep);
    }

    return output;
}

function split2(input: string) {
    const output: string[] = [];
    const base = isAbsolute(input) ? input : resolve(input);

    let match: RegExpExecArray | null;
    const rgx = new RegExp(`[${sep}]+`, "g");

    while (match = rgx.exec(base)) {
        output.push(base.slice(0, match.index) || "/");
    }

    return output.reverse();
}

function split3(input: string) {
    const base = isAbsolute(input) ? input : resolve(input);
    let length_ = base.length;
    const output: string[] = [];

    while (length_-- > 0) {
        if (base.charCodeAt(length_) === 47) {
            output.push(base.slice(0, length_) || "/");
        }
    }

    return output;
}

function split4(input: string) {
    const base = isAbsolute(input) ? input : resolve(input);
    let length_ = base.length;
    const output: string[] = [];

    while (length_-- > 0) {
        if (base.charAt(length_) === sep) {
            output.push(base.slice(0, length_) || sep);
        }
    }

    return output;
}

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
