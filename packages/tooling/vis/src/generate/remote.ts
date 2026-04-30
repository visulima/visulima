/**
 * Remote template fetching for `vis generate`.
 *
 * Reuses giget (already a vis dep, used by `vis create`) to fetch
 * `git://`, `npm://`, and `https://` archive sources into a cache
 * directory before discover/load runs against them.
 *
 * Sources are normalized via the same patterns vis create uses; see
 * `src/commands/create/templates/remote.ts` for the underlying
 * downloadTemplate call.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { downloadTemplate } from "giget";

import { pail } from "../io/logger";

const REMOTE_PROTOCOLS = ["git://", "npm://", "https://", "github:", "gitlab:", "bitbucket:", "sourcehut:"];

/**
 * True when the input looks like a remote source giget can resolve.
 */
export const isRemoteSource = (input: string): boolean => REMOTE_PROTOCOLS.some((protocol) => input.startsWith(protocol));

interface FetchOptions {
    /** Auth token forwarded to giget for private repos. */
    auth?: string;
    /** Prefer cached templates over re-download. */
    preferOffline?: boolean;
    /** Override the cache/work directory (defaults to a fresh tmp). */
    targetDirectory?: string;
}

export interface FetchResult {
    /**
     * Release the tmp directory once the caller has finished loading
     * the template into memory. No-op when the directory was supplied
     * externally via `targetDirectory`.
     */
    cleanup: () => void;
    /** Absolute directory containing the downloaded template. */
    directory: string;
}

/**
 * Download a remote template and return the directory it lives in.
 * @example
 * ```typescript
 * const { directory } = await fetchRemoteTemplate("git://github.com/org/template#main");
 * const template = await loadMoonTemplate(directory, "from-git");
 * ```
 */
export const fetchRemoteTemplate = async (source: string, options: FetchOptions = {}): Promise<FetchResult> => {
    const ownDirectory = options.targetDirectory === undefined;
    const directory = options.targetDirectory ?? mkdtempSync(join(tmpdir(), "vis-generate-"));

    const cleanup = (): void => {
        if (!ownDirectory) {
            return;
        }

        try {
            rmSync(directory, { force: true, recursive: true });
        } catch {
            // Best-effort cleanup. The OS will reap the tmp dir on reboot.
        }
    };

    pail.info(`Downloading ${source}…`);

    try {
        const result = await downloadTemplate(source, {
            auth: options.auth || process.env.GIGET_AUTH || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
            dir: directory,
            force: true,
            preferOffline: options.preferOffline,
        });

        return { cleanup, directory: result.dir };
    } catch (error) {
        cleanup();

        const message = error instanceof Error ? error.message : String(error);

        pail.warn(`Failed to download template: ${message}`);

        throw error;
    }
};
