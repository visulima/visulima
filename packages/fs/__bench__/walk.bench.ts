import * as walk from "empathic/walk";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { bench, describe } from "vitest";

import visulimaWalk from "../src/find/walk";
import visulimaWalkSync from "../src/find/walk-sync";

// let start = ".";
// let start = resolve('fixtures/a/b/c/d/e/f/g/h/i/j/start.txt');
const start = "fixtures/a/b/c/d/e/f/g/h/i/j/start.txt";

const absolute = (input: string, root?: string): string => {
    return isAbsolute(input) ? input : resolve(root || ".", input);
};

function alt1(base: string) {
    let prev = absolute(base);
    let tmp = dirname(prev);
    let arr: string[] = [];

    while (true) {
        arr.push(tmp);
        tmp = dirname((prev = tmp));
        if (tmp === prev) return arr;
    }
}

function split1(input: string) {
    let arr = (isAbsolute(input) ? input : resolve(input)).split(sep);
    let i = 0,
        len = arr.length,
        output = Array<string>(len);
    for (; i < len; i++) {
        output[i] = arr.slice(0, len - i).join(sep);
    }
    return output;
}

function split2(input: string) {
    let output: string[] = [];
    let base = isAbsolute(input) ? input : resolve(input);

    let match: RegExpExecArray | null;
    let rgx = new RegExp("[" + sep + "]+", "g");

    while ((match = rgx.exec(base))) {
        output.push(base.slice(0, match.index) || "/");
    }

    return output.reverse();
}

function split3(input: string) {
    let base = isAbsolute(input) ? input : resolve(input);
    let len = base.length,
        output: string[] = [];

    while (len-- > 0) {
        if (base.charCodeAt(len) === 47) {
            output.push(base.slice(0, len) || "/");
        }
    }

    return output;
}

function split4(input: string) {
    let base = isAbsolute(input) ? input : resolve(input);
    let len = base.length,
        output: string[] = [];

    while (len-- > 0) {
        if (base.charAt(len) === sep) {
            output.push(base.slice(0, len) || sep);
        }
    }

    return output;
}

describe("walk.up and split variants", () => {
    bench("empathic/walk.up (no options)", () => {
        let total = 0;
        for (let _ of alt1(start)) {
            total += 1;
        }
    });

    bench("empathic/walk.up", () => {
        let total = 0;
        for (let _ of walk.up(start)) {
            total += 1;
        }
    });

    bench("@visulima/fs walk", async () => {
        let total = 0;
        for await (let _ of visulimaWalk(dirname(start), {})) {
            total += 1;
        }
    });

    bench("@visulima/fs walk-sync", () => {
        let total = 0;
        for (let _ of visulimaWalkSync(dirname(start), {})) {
            total += 1;
        }
    });

    bench("split1", () => {
        let total = 0;
        for (let _ of split1(start)) {
            total += 1;
        }
    });

    bench("split2", () => {
        let total = 0;
        for (let _ of split2(start)) {
            total += 1;
        }
    });

    bench("split3", () => {
        let total = 0;
        for (let _ of split3(start)) {
            total += 1;
        }
    });

    bench("split4", () => {
        let total = 0;
        for (let _ of split4(start)) {
            total += 1;
        }
    });
});
