import type { UrlStorage, UrlStorageEntry } from "../url-storage";

export interface TusResumeStore {
    /** The stored TUS resume URL for `fingerprint`, if any. Storage failures count as a miss. */
    find: (fingerprint: string) => Promise<string | undefined>;
    /** Remembers `uploadUrl` as the resume URL for `fingerprint`. */
    persist: (fingerprint: string, uploadUrl: string, file: File) => Promise<void>;
    /** Forgets the resume URL for `fingerprint`. */
    remove: (fingerprint: string | undefined) => Promise<void>;
}

/**
 * Wraps the optional `UrlStorage` for TUS resume URLs. Every operation is a
 * no-op without storage and never rejects — persistence is best effort, the
 * upload still works in-process.
 */
export const createTusResumeStore = (endpoint: string, urlStorage: UrlStorage | undefined): TusResumeStore => {
    return {
        find: async (fingerprint: string): Promise<string | undefined> => {
            if (!urlStorage) {
                return undefined;
            }

            try {
                const stored = await urlStorage.findEntry(fingerprint);

                return stored?.protocol === "tus" ? stored.uploadUrl : undefined;
            } catch {
                return undefined;
            }
        },

        persist: async (fingerprint: string, uploadUrl: string, file: File): Promise<void> => {
            if (!urlStorage) {
                return;
            }

            const entry: UrlStorageEntry = {
                createdAt: Date.now(),
                endpoint,
                fingerprint,
                lastModified: file.lastModified,
                protocol: "tus",
                size: file.size,
                uploadUrl,
            };

            try {
                await urlStorage.addEntry(entry);
            } catch {
                // Storage failures are non-fatal — the upload still works in-process.
            }
        },

        remove: async (fingerprint: string | undefined): Promise<void> => {
            if (!urlStorage || !fingerprint) {
                return;
            }

            try {
                await urlStorage.removeEntry(fingerprint);
            } catch {
                // Non-fatal.
            }
        },
    };
};
