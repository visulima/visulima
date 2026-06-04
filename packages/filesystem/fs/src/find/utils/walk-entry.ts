import type { Dirent, Stats } from "node:fs";

import type { WalkEntry } from "../../types";

type WalkEntrySource = Pick<Dirent | Stats, "isDirectory" | "isFile" | "isSymbolicLink">;

/**
 * Backing object for a {@link WalkEntry}. The three type-test methods live on the
 * prototype and delegate to the underlying `Dirent`/`Stats`, so walking a large tree
 * allocates a single object per entry instead of one object plus three per-entry
 * closures (which esbuild's `keepNames` would otherwise also name-tag on every entry).
 */
class WalkEntryImpl implements WalkEntry {
    public readonly name: string;

    public readonly path: string;

    readonly #source: WalkEntrySource;

    public constructor(source: WalkEntrySource, name: string, path: string) {
        this.#source = source;
        this.name = name;
        this.path = path;
    }

    public isDirectory(): boolean {
        return this.#source.isDirectory();
    }

    public isFile(): boolean {
        return this.#source.isFile();
    }

    public isSymbolicLink(): boolean {
        return this.#source.isSymbolicLink();
    }
}

/** Create a {@link WalkEntry} that delegates its type-test methods to `source` (a `Dirent` or `Stats`). */
const createWalkEntry = (source: WalkEntrySource, name: string, path: string): WalkEntry => new WalkEntryImpl(source, name, path);

export default createWalkEntry;
