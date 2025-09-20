import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const cache = new Map<string, string>();

// No extra helpers needed; use fetch for non-file URLs

const getFileSource = async (file: string): Promise<string | undefined> => {
    if (!/^(?:http|https|file|data):/.test(file)) {
        return undefined;
    }

    if (cache.has(file)) {
        return cache.get(file);
    }

    if (file.startsWith("file:")) {
        try {
            const path = fileURLToPath(file);
            const source = await readFile(path, "utf8");

            cache.set(file, source);

            return source;
        } catch (error) {
            return undefined;
        }
    }

    try {
        const response = await fetch(file);
        if (!response.ok) {
            return undefined;
        }
        const source = await response.text();

        cache.set(file, source);

        return source;
    } catch (error) {
        return undefined;
    }
};

export default getFileSource;
