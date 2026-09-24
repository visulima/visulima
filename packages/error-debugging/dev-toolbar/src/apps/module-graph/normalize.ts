/** One row of the module list, normalised from whatever the server sent. */
export interface ModuleEntry {
    ext: string;
    id: string;
    importers: number;
    importerUrls: string[];
    url: string;
}

const EXT_REGEX = /\.([a-z]+)(?:\?|$)/i;

/**
 * The file extension of a module URL, lowercased.
 *
 * Vite appends query strings (`?v=`, `?import`, `?worker`), so the match stops
 * at the first `?`. Returns `"?"` when there is nothing extension-shaped.
 */
export const getExtension = (url: string): string => {
    const match = url.match(EXT_REGEX);

    return match?.[1]?.toLowerCase() ?? "?";
};

/**
 * Normalises the raw module graph.
 *
 * `url` and `id` each stand in for the other when one is absent, so a module
 * that reports only one of them still lists and still has a stable key.
 */
export const toModuleEntries = (raw: unknown[]): ModuleEntry[] =>
    raw.map((entry) => {
        const module_ = (entry ?? {}) as { id?: string; importerCount?: number; importerUrls?: unknown; url?: string };
        const url = module_.url ?? module_.id ?? "";

        return {
            ext: getExtension(url),
            id: module_.id ?? module_.url ?? "",
            importers: module_.importerCount ?? 0,
            importerUrls: Array.isArray(module_.importerUrls) ? (module_.importerUrls as string[]) : [],
            url,
        };
    });

/** Case-insensitive match on the URL or the extension. Empty query matches everything. */
export const filterModules = (modules: ModuleEntry[], query: string): ModuleEntry[] => {
    const needle = query.toLowerCase();

    if (!needle) {
        return modules;
    }

    return modules.filter((module_) => module_.url.toLowerCase().includes(needle) || module_.ext.includes(needle));
};
