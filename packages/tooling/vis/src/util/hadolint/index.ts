/**
 * hadolint binary manager.
 *
 * hadolint is a single static Haskell binary published per-platform on
 * GitHub releases. It is GPL-3.0, so vis MUST NOT vendor/bundle it — we
 * download it on demand (with the user's consent) into the per-user cache
 * and exec it as a separate process. Running a GPL binary as a subprocess
 * does not make vis a derivative work, which keeps the npm package MIT.
 *
 * Resolution order in {@link ensureHadolint}:
 *   1. a `hadolint` already on `$PATH` (user/CI-installed) — preferred;
 *   2. a previously downloaded copy in the cache;
 *   3. otherwise prompt the user to download the pinned version.
 *
 * The runner uses `--format json --no-fail` so hadolint always exits 0 and
 * we own the exit-code decision in the command handler.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { bold, cyan, dim } from "@visulima/colorize";
import { ensureDirSync } from "@visulima/fs";
import { join } from "@visulima/path";
import isInCi from "is-in-ci";

import { getVisCacheDir } from "../vis-paths";

/** Pinned hadolint release. Bump together with a re-run of the lint tests. */
export const HADOLINT_VERSION = "v2.14.0";

const RELEASE_BASE = `https://github.com/hadolint/hadolint/releases/download/${HADOLINT_VERSION}`;

/** A single hadolint (or embedded ShellCheck) finding from `--format json`. */
export interface HadolintFinding {
    /** Pattern id — `DL3006`, `SC2086`, … */
    code: string;
    column: number;
    file: string;
    /** hadolint severity. */
    level: "error" | "info" | "style" | "warning";
    line: number;
    message: string;
}

/**
 * Maps the current platform/arch to the hadolint release asset name.
 * Asset names are lowercase as of v2.x (`hadolint-linux-x86_64`, …).
 * @returns The asset filename, or undefined on an unsupported platform.
 */
export const resolveHadolintAsset = (platform: NodeJS.Platform = process.platform, arch: string = process.arch): string | undefined => {
    const os = platform === "darwin" ? "macos" : platform === "linux" ? "linux" : platform === "win32" ? "windows" : undefined;

    if (os === undefined) {
        return undefined;
    }

    const cpu = arch === "arm64" ? "arm64" : arch === "x64" ? "x86_64" : undefined;

    // hadolint ships no Windows arm64 build; x86_64 runs under emulation.
    if (os === "windows") {
        return "hadolint-windows-x86_64.exe";
    }

    if (cpu === undefined) {
        return undefined;
    }

    return `hadolint-${os}-${cpu}`;
};

const cachedBinaryPath = (asset: string): string => join(getVisCacheDir(), "hadolint", HADOLINT_VERSION, asset.endsWith(".exe") ? "hadolint.exe" : "hadolint");

/** Looks for an executable `hadolint` on `$PATH`. Returns its name if found. */
const findOnPath = (): string | undefined => {
    const binary = process.platform === "win32" ? "hadolint.exe" : "hadolint";
    const dirs = (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":");

    for (const dir of dirs) {
        if (dir !== "" && existsSync(join(dir, binary))) {
            return binary;
        }
    }

    return undefined;
};

/** Parses the first whitespace-delimited token of a hadolint `.sha256` sidecar. */
const parseSha256Sidecar = (text: string): string => text.trim().split(/\s+/u)[0] ?? "";

const fetchBuffer = async (url: string): Promise<Buffer> => {
    const response = await fetch(url, { redirect: "follow" });

    if (!response.ok) {
        throw new Error(`download failed (${String(response.status)} ${response.statusText}) for ${url}`);
    }

    return Buffer.from(await response.arrayBuffer());
};

/**
 * Downloads the pinned hadolint binary + its `.sha256` sidecar, verifies
 * the digest, writes it to {@link cachedBinaryPath} and marks it
 * executable.
 * @param asset The release asset filename.
 * @returns The path to the cached executable.
 * @throws If the download fails or the checksum does not match.
 */
const downloadHadolint = async (asset: string): Promise<string> => {
    const destination = cachedBinaryPath(asset);

    const [binary, sidecar] = await Promise.all([fetchBuffer(`${RELEASE_BASE}/${asset}`), fetchBuffer(`${RELEASE_BASE}/${asset}.sha256`)]);

    const expected = parseSha256Sidecar(sidecar.toString("utf8")).toLowerCase();
    const actual = createHash("sha256").update(binary).digest("hex");

    // Fail closed: a missing/unparseable checksum is treated as a failure
    // rather than silently trusting an unverified binary.
    if (expected === "") {
        throw new Error("hadolint checksum sidecar was empty or unparseable. Refusing to use the download.");
    }

    if (expected !== actual) {
        throw new Error(`hadolint checksum mismatch (expected ${expected}, got ${actual}). Refusing to use the download.`);
    }

    ensureDirSync(join(getVisCacheDir(), "hadolint", HADOLINT_VERSION));
    writeFileSync(destination, binary);

    if (process.platform !== "win32") {
        chmodSync(destination, 0o755);
    }

    return destination;
};

const confirmInstall = async (): Promise<boolean> => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });

    const answer = await new Promise<string>((resolve) => {
        rl.question(`  Download hadolint ${cyan(HADOLINT_VERSION)} now? ${dim("[y/N]")} `, (value) => {
            resolve(value.trim().toLowerCase());
        });
    });

    rl.close();

    return answer === "y" || answer === "yes";
};

export interface EnsureHadolintOptions {
    /** Skip the prompt and download immediately (e.g. `--install`). */
    autoInstall?: boolean;
    /** Sink for human-facing status lines. */
    log: (message: string) => void;
}

/**
 * Resolves a usable hadolint executable, downloading it (with consent)
 * when necessary.
 *
 * Returns the path/command to invoke, or `undefined` when hadolint is
 * unavailable and the user declined (or could not be prompted) to install
 * it. Callers should treat `undefined` as "skip linting" rather than an
 * error.
 * @param options Behaviour controls.
 */
export const ensureHadolint = async (options: EnsureHadolintOptions): Promise<string | undefined> => {
    const { autoInstall = false, log } = options;

    const onPath = findOnPath();

    if (onPath !== undefined) {
        return onPath;
    }

    const asset = resolveHadolintAsset();

    if (asset === undefined) {
        log(`hadolint has no prebuilt binary for ${process.platform}/${process.arch}. Install it manually: https://github.com/hadolint/hadolint`);

        return undefined;
    }

    const cached = cachedBinaryPath(asset);

    if (existsSync(cached)) {
        return cached;
    }

    // Decide whether we may download.
    if (!autoInstall) {
        const interactive = Boolean(process.stdin.isTTY) && !isInCi;

        if (!interactive) {
            log(`hadolint is not installed. Re-run with ${bold("--install")} (or install hadolint on PATH) to enable Dockerfile linting.`);

            return undefined;
        }

        log(`${bold("hadolint")} is required to lint Dockerfiles but was not found on your PATH.`);

        const accepted = await confirmInstall();

        if (!accepted) {
            log(`Skipped. Install it yourself or re-run with ${bold("--install")}.`);

            return undefined;
        }
    }

    log(`Downloading hadolint ${HADOLINT_VERSION} (${asset})…`);

    try {
        const path = await downloadHadolint(asset);

        log(`Installed hadolint to ${dim(path)}`);

        return path;
    } catch (error) {
        log(`Failed to download hadolint: ${(error as Error).message}`);

        return undefined;
    }
};

/**
 * Runs hadolint over the given Dockerfiles and returns parsed findings.
 *
 * Uses `--no-fail` so hadolint exits 0 even with findings; the caller
 * decides the process exit code. A non-empty `configPath` is passed via
 * `--config` so repo-level `.hadolint.yaml` ignore rules are honoured.
 * @param binary The hadolint executable resolved by {@link ensureHadolint}.
 * @param files Absolute Dockerfile paths to lint.
 * @param configPath Optional hadolint config file.
 */
export const runHadolint = async (binary: string, files: string[], configPath?: string): Promise<HadolintFinding[]> => {
    if (files.length === 0) {
        return [];
    }

    const cliArguments = ["--format", "json", "--no-fail", ...(configPath !== undefined && configPath !== "" ? ["--config", configPath] : []), ...files];

    const stdout = await new Promise<string>((resolve, reject) => {
        const child = spawn(binary, cliArguments, {
            shell: process.platform === "win32",
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });

        let out = "";
        let error = "";

        child.stdout?.on("data", (chunk: Buffer) => {
            out += chunk.toString("utf8");
        });
        child.stderr?.on("data", (chunk: Buffer) => {
            error += chunk.toString("utf8");
        });
        child.on("error", reject);
        child.on("close", () => {
            // hadolint writes the JSON array to stdout; stderr only carries
            // fatal usage errors, which surface as empty/invalid stdout below.
            if (out.trim() === "" && error.trim() !== "") {
                reject(new Error(error.trim()));

                return;
            }

            resolve(out);
        });
    });

    if (stdout.trim() === "") {
        return [];
    }

    let parsed: unknown;

    try {
        parsed = JSON.parse(stdout);
    } catch {
        throw new Error("Could not parse hadolint JSON output.");
    }

    if (!Array.isArray(parsed)) {
        return [];
    }

    return parsed as HadolintFinding[];
};
