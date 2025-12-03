import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { up } from "empathic/walk";

const COUNT = +(process.argv[2] ?? "6");

const fixtures = resolve("fixtures");
const start = join(fixtures, "a/b/c/d/e/f/g/h/i/j");

/**
 *
 */
async function main() {
    if (!existsSync(start)) {
        await mkdir(start, {
            recursive: true,
        });

        await writeFile(join(start, "start.txt"), "");

        // targets for bench/tests
        await writeFile(join(fixtures, "a/b/c/d/e/f/file.txt"), "");

        await writeFile(join(fixtures, "a/b/package.json"), "{}");

        await writeFile(join(fixtures, "a/b/c/resolved.js"), "");
    }

    for await (const directory of up(start)) {
        if (directory === fixtures) break;

        if (COUNT > 0) {
            const name = Math.random().toString(16).slice(4);

            await Promise.all(Array.from({ length: COUNT }, (_, index) => writeFile(join(directory, `${name + index}.txt`), "")));
        }

        const array = await readdir(directory);

        // eslint-disable-next-line no-console
        console.log('> "%s" has %d file(s)', directory, array.length);
    }
}

main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
});
