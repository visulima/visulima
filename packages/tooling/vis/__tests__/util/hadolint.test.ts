import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { HADOLINT_VERSION, pinnedAssetDigest, resolveHadolintAsset, runHadolint } from "../../src/util/hadolint";

describe("hadolint binary resolution", () => {
    it("pins a versioned release", () => {
        expect.assertions(1);

        expect(HADOLINT_VERSION).toMatch(/^v\d+\.\d+\.\d+$/u);
    });

    it("maps linux platforms", () => {
        expect.assertions(2);

        expect(resolveHadolintAsset("linux", "x64")).toBe("hadolint-linux-x86_64");
        expect(resolveHadolintAsset("linux", "arm64")).toBe("hadolint-linux-arm64");
    });

    it("maps macOS to the 'macos' asset prefix", () => {
        expect.assertions(2);

        expect(resolveHadolintAsset("darwin", "x64")).toBe("hadolint-macos-x86_64");
        expect(resolveHadolintAsset("darwin", "arm64")).toBe("hadolint-macos-arm64");
    });

    it("maps Windows to the .exe asset regardless of arch", () => {
        expect.assertions(2);

        expect(resolveHadolintAsset("win32", "x64")).toBe("hadolint-windows-x86_64.exe");
        expect(resolveHadolintAsset("win32", "arm64")).toBe("hadolint-windows-x86_64.exe");
    });

    it("returns undefined on unsupported platforms/arches", () => {
        expect.assertions(2);

        expect(resolveHadolintAsset("freebsd", "x64")).toBeUndefined();
        expect(resolveHadolintAsset("linux", "ppc64")).toBeUndefined();
    });
});

describe("hadolint pinned digests", () => {
    const supported: [NodeJS.Platform, string][] = [
        ["linux", "x64"],
        ["linux", "arm64"],
        ["darwin", "x64"],
        ["darwin", "arm64"],
        ["win32", "x64"],
        ["win32", "arm64"],
    ];

    it("pins a source-baked SHA-256 for every resolvable asset", () => {
        expect.assertions(6);

        for (const [platform, arch] of supported) {
            const asset = resolveHadolintAsset(platform, arch);

            // Every platform vis can resolve an asset for must have an
            // attacker-independent digest baked in, so the download check
            // never falls back to the same-origin sidecar.
            expect(asset === undefined ? undefined : pinnedAssetDigest(asset)).toMatch(/^[\da-f]{64}$/u);
        }
    });

    it("returns undefined for an unpinned asset name", () => {
        expect.assertions(1);

        expect(pinnedAssetDigest("hadolint-solaris-sparc")).toBeUndefined();
    });
});

describe("hadolint runner", () => {
    it("returns [] for an empty file list without spawning a binary", async () => {
        expect.assertions(1);

        await expect(runHadolint("definitely-not-a-real-binary", [])).resolves.toStrictEqual([]);
    });

    // Spawns a fake binary; shebang scripts don't run as-is on Windows.
    it.skipIf(process.platform === "win32")("parses the JSON array a hadolint-like binary prints to stdout", async () => {
        expect.assertions(2);

        const dir = mkdtempSync(join(tmpdir(), "vis-hadolint-run-"));
        const fake = join(dir, "fake-hadolint");

        writeFileSync(
            fake,
            "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify([{ file: \"Dockerfile\", line: 3, column: 1, level: \"warning\", code: \"DL3006\", message: \"pin versions\" }]));\n",
        );
        chmodSync(fake, 0o755);

        try {
            const findings = await runHadolint(fake, ["Dockerfile"]);

            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({ code: "DL3006", level: "warning", line: 3 });
        } finally {
            rmSync(dir, { force: true, recursive: true });
        }
    });
});
