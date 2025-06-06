import { readFile } from "node:fs/promises";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { getUri } from "get-uri";

const cache = new Map<string, string>();

const streamToString = (stream: Readable): Promise<string> => {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => {
            chunks.push(Buffer.from(chunk));
        });
        stream.on("error", (error) => {
            reject(error);
        });
        stream.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf8"));
        });
    });
};

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
            console.log(error);

            return undefined;
        }
    }

    try {
        const fileContent = await getUri(file);
        const source = await streamToString(fileContent);

        cache.set(file, source);

        return source;
    } catch (error) {
        console.log(error);

        return undefined;
    }
};

export default getFileSource;
