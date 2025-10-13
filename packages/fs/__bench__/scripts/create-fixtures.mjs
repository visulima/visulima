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

    for (let dir of up(start)) {
        if (dir === fixtures)
            break;

        if (COUNT > 0) {
            let name = Math.random().toString(16).slice(4);

            await Promise.all(Array.from({ length: COUNT }, (_, index) => writeFile(join(dir, `${name + index}.txt`), "")));
        }

        let array = await readdir(dir);

        console.log("> \"%s\" has %d file(s)", dir, array.length);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
