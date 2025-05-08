import * as fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import * as walk from "empathic/walk";

const COUNT = +(process.argv[2] ?? "6");

const fixtures = resolve("fixtures");
const start = join(fixtures, "a/b/c/d/e/f/g/h/i/j");

async function main() {
    if (!existsSync(start)) {
        await fs.mkdir(start, {
            recursive: true,
        });

        await fs.writeFile(join(start, "start.txt"), "");

        // targets for bench/tests
        await fs.writeFile(join(fixtures, "a/b/c/d/e/f/file.txt"), "");

        await fs.writeFile(join(fixtures, "a/b/package.json"), "{}");

        await fs.writeFile(join(fixtures, "a/b/c/resolved.js"), "");
    }

    for (let dir of walk.up(start)) {
        if (dir === fixtures) break;

        if (COUNT > 0) {
            let name = Math.random().toString(16).slice(4);

            await Promise.all(
                Array.from({ length: COUNT }, (_, idx) => {
                    return fs.writeFile(join(dir, name + idx + ".txt"), "");
                }),
            );
        }

        let arr = await fs.readdir(dir);
        console.log('> "%s" has %d file(s)', dir, arr.length);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
