import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTarBrotli, extractTarBrotli } from "../../src/archive";

let workspaceRoot: string;

beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), "task-runner-archive-"));
});

afterEach(async () => {
    await rm(workspaceRoot, { force: true, recursive: true });
});

describe("archive round-trip fidelity", () => {
    it("restores file mtime to within one second of the original", async () => {
        expect.assertions(2);

        const sourceDirectory = join(workspaceRoot, "src");
        const destinationDirectory = join(workspaceRoot, "dst");
        const archivePath = join(workspaceRoot, "out.tar.br");
        const file = join(sourceDirectory, "bundle.js");

        await mkdir(sourceDirectory, { recursive: true });
        await writeFile(file, "console.log('hello');\n");

        // Pin the source mtime to a known moment well in the past so we
        // can prove the restore preserved it (and didn't just stamp
        // "now"). Tar headers are second-precision, so use an integer
        // seconds value to avoid round-off when comparing.
        const pinnedSeconds = 1_700_000_000;
        const pinnedDate = new Date(pinnedSeconds * 1000);

        await utimes(file, pinnedDate, pinnedDate);

        await createTarBrotli(sourceDirectory, archivePath);
        await extractTarBrotli(archivePath, destinationDirectory);

        const restoredStat = await stat(join(destinationDirectory, "bundle.js"));
        const restoredSeconds = Math.floor(restoredStat.mtimeMs / 1000);

        expect(restoredSeconds).toBe(pinnedSeconds);

        const restoredContent = await readFile(join(destinationDirectory, "bundle.js"), "utf8");

        expect(restoredContent).toBe("console.log('hello');\n");
    });

    it("preserves file mode bits across round-trip", async () => {
        expect.assertions(1);

        const sourceDirectory = join(workspaceRoot, "src");
        const destinationDirectory = join(workspaceRoot, "dst");
        const archivePath = join(workspaceRoot, "out.tar.br");
        const file = join(sourceDirectory, "run.sh");

        await mkdir(sourceDirectory, { recursive: true });
        await writeFile(file, "#!/bin/sh\necho hi\n", { mode: 0o755 });

        await createTarBrotli(sourceDirectory, archivePath);
        await extractTarBrotli(archivePath, destinationDirectory);

        const restoredStat = await stat(join(destinationDirectory, "run.sh"));

        // eslint-disable-next-line no-bitwise -- low 12 bits hold the rwx triplet
        expect(restoredStat.mode & 0o777).toBe(0o755);
    });

    it("falls back to 'now' mtime when preserveMtime is disabled", async () => {
        expect.assertions(1);

        const sourceDirectory = join(workspaceRoot, "src");
        const destinationDirectory = join(workspaceRoot, "dst");
        const archivePath = join(workspaceRoot, "out.tar.br");
        const file = join(sourceDirectory, "bundle.js");

        await mkdir(sourceDirectory, { recursive: true });
        await writeFile(file, "x");

        const pinnedSeconds = 1_700_000_000;
        const pinnedDate = new Date(pinnedSeconds * 1000);

        await utimes(file, pinnedDate, pinnedDate);

        await createTarBrotli(sourceDirectory, archivePath);

        const beforeRestoreMs = Date.now();

        await extractTarBrotli(archivePath, destinationDirectory, { preserveMtime: false });

        const restoredStat = await stat(join(destinationDirectory, "bundle.js"));

        // Mtime should reflect the extract time, not the captured one.
        // Allow 1s slack on either side for filesystem rounding.
        expect(restoredStat.mtimeMs).toBeGreaterThanOrEqual(beforeRestoreMs - 1000);
    });

    it("falls back to umask-derived mode when preservePerms is disabled", async () => {
        expect.assertions(2);

        const sourceDirectory = join(workspaceRoot, "src");
        const destinationDirectory = join(workspaceRoot, "dst");
        const archivePath = join(workspaceRoot, "out.tar.br");
        const file = join(sourceDirectory, "run.sh");

        await mkdir(sourceDirectory, { recursive: true });
        await writeFile(file, "x", { mode: 0o755 });

        await createTarBrotli(sourceDirectory, archivePath);

        // Pin umask to a known value so we can assert the *exact* mode
        // bits writeFile produces (not just "executable bits dropped").
        // 0o022 → newly created files land at 0o644.
        const previousUmask = process.umask(0o022);

        try {
            await extractTarBrotli(archivePath, destinationDirectory, { preservePerms: false });

            const restoredStat = await stat(join(destinationDirectory, "run.sh"));

            // eslint-disable-next-line no-bitwise -- mode triplet is in low 9 bits
            expect(restoredStat.mode & 0o777).toBe(0o644);
            // eslint-disable-next-line no-bitwise -- assert executable bits specifically dropped
            expect(restoredStat.mode & 0o111).toBe(0);
        } finally {
            process.umask(previousUmask);
        }
    });
});
