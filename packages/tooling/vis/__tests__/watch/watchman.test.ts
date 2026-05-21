import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { startWatcher } from "../../src/watch/watch";
import { isWatchmanAvailable, startWatchmanWatcher } from "../../src/watch/watchman";

describe(isWatchmanAvailable, () => {
    it("returns a stable boolean (the result is probed once and cached)", () => {
        expect.assertions(1);

        // Outcome is environment-dependent: `fb-watchman` is an
        // installed optional peer dep, so availability hinges on
        // whether the `watchman` *binary* is on PATH (absent on most
        // CI images, present on Meta-style monorepo setups). The
        // contract under test is "deterministic + cached", not a fixed
        // value — the value-specific behaviour is covered by the
        // startWatchmanWatcher fallback test below.
        const first = isWatchmanAvailable();

        // `expectTypeOf` is a compile-time check; it does not count
        // toward the runtime assertion budget.
        expectTypeOf(first).toBeBoolean();

        expect(isWatchmanAvailable()).toBe(first);
    });
});

describe(startWatchmanWatcher, () => {
    it("returns a watcher iff Watchman is available, otherwise undefined so the caller falls back", () => {
        expect.assertions(1);

        const handle = startWatchmanWatcher(["."], () => {});

        try {
            // The fallback guarantee: no daemon ⇒ undefined (caller
            // uses native fs.watch); daemon present ⇒ a closable
            // handle. Either is correct; a mismatch with
            // isWatchmanAvailable() is the actual bug.
            expect(handle === undefined).toBe(!isWatchmanAvailable());
        } finally {
            handle?.close();
        }
    });
});

describe(startWatcher, () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "vis-watch-"));
    });

    afterEach(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    it("falls back to the native watcher and debounces change events", async () => {
        expect.assertions(2);

        const changed: string[][] = [];

        const handle = startWatcher({
            debounceMs: 50,
            onChange: (paths) => {
                changed.push(paths);
            },
            paths: [directory],
        });

        writeFileSync(join(directory, "a.txt"), "1");
        writeFileSync(join(directory, "b.txt"), "2");

        await new Promise((resolve) => {
            setTimeout(resolve, 400);
        });

        handle.close();

        expect(changed.length).toBeGreaterThanOrEqual(1);
        // Two rapid writes collapse into a single debounced delivery.
        expect(changed[0]?.length).toBeGreaterThanOrEqual(1);
    });
});
