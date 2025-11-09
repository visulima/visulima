const hasBuffer = globalThis.Buffer !== undefined;

/**
 * Convert content to base64 string
 * Works across Node.js, Deno, Bun, and Workers
 */
export const toBase64 = (content: string | Buffer | Uint8Array): string => {
    if (typeof content === "string") {
        if (hasBuffer) {
            return Buffer.from(content, "utf8").toString("base64");
        }

        const encoder = new TextEncoder();
        const bytes = encoder.encode(content);

        return btoa(String.fromCharCode(...bytes));
    }

    if (hasBuffer && content instanceof Buffer) {
        return content.toString("base64");
    }

    const uint8Array = content instanceof Uint8Array ? content : new Uint8Array(content as ArrayLike<number>);

    if (hasBuffer) {
        return Buffer.from(uint8Array).toString("base64");
    }

    return btoa(String.fromCharCode(...uint8Array));
};
