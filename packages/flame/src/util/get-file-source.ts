import type { Readable } from "node:stream";

import { getUri } from "get-uri";

const cache = new Map<string, string>();

const streamToString = async (stream: Readable) => {
    const chunks = [];

    try {
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }

        return Buffer.concat(chunks).toString("utf-8");
    } finally {
        if (stream.destroy) {
            stream.destroy();
        }
    }
};

const getFileSource = async (file: string): Promise<string | undefined> => {
    if (!/^(http|https|file):\/\/|data:/.test(file)) {
        return undefined;
    }

    if (cache.has(file)) {
        return cache.get(file);
    }

    try {
        const fileContent = await getUri(file);

        // TODO: fix this
        const source = ""; // await streamToString(fileContent);

        cache.set(file, source);

        return source;
    } catch (error) {
        console.log(error);

        return undefined;
    }
};

export default getFileSource;
