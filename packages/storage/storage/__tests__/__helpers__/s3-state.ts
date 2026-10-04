/** An object in the in-memory bucket. */
export interface S3Object {
    body: Buffer;
    contentType?: string;
    etag: string;
    expires?: Date;
    lastModified: Date;
    metadata: Record<string, string>;
}

/** An unfinished multipart upload in the in-memory bucket. */
export interface S3Upload {
    contentType?: string;
    initiated: Date;
    key: string;
    metadata: Record<string, string>;
    parts: Map<number, { body: Buffer; etag: string }>;
}

/**
 * Objects and multipart uploads of an in-memory S3 bucket, shared by the SDK fake (S3Storage) and
 * the HTTP fake (aws-light), which only translate requests into these operations.
 */
export const createS3State = () => {
    const objects = new Map<string, S3Object>();
    const uploads = new Map<string, S3Upload>();
    let counter = 0;

    const etag = (): string => {
        counter += 1;

        return `"e${String(counter)}"`;
    };

    const put = (key: string, body: Buffer, init: { contentType?: string; metadata?: Record<string, string> } = {}): S3Object => {
        const object = { body, contentType: init.contentType, etag: etag(), lastModified: new Date(), metadata: init.metadata ?? {} };

        objects.set(key, object);

        return object;
    };

    /** The parts of an upload by number, or `undefined` when there is no such upload. */
    const parts = (uploadId: string): [number, { body: Buffer; etag: string }][] | undefined => {
        const upload = uploads.get(uploadId);

        return upload && [...upload.parts].toSorted(([a], [b]) => a - b);
    };

    return {
        /** Aborts an upload; `false` when there is none. */
        abort: (uploadId: string): boolean => uploads.delete(uploadId),

        /** Assembles an upload from `partNumbers` (default: all, in order) into its object. */
        complete: (uploadId: string, partNumbers?: number[]): S3Object | undefined => {
            const upload = uploads.get(uploadId);

            if (!upload) {
                return undefined;
            }

            const numbers = partNumbers ?? (parts(uploadId) ?? []).map(([number]) => number);
            const body = Buffer.concat(numbers.map((number) => upload.parts.get(number)?.body ?? Buffer.alloc(0)));

            uploads.delete(uploadId);

            return put(upload.key, body, upload);
        },

        /** Copies an object; `false` when the source is missing. */
        copy: (source: string, key: string): boolean => {
            const object = objects.get(source);

            if (object) {
                objects.set(key, { ...object, etag: etag(), lastModified: new Date() });
            }

            return object !== undefined;
        },

        createUpload: (key: string, init: { contentType?: string; metadata?: Record<string, string> } = {}): string => {
            const id = `u${String(uploads.size + 1)}-${String(counter)}`;

            uploads.set(id, { contentType: init.contentType, initiated: new Date(), key, metadata: init.metadata ?? {}, parts: new Map() });

            return id;
        },

        /**
         * One page of the keys under `prefix`, keys sharing a `delimiter` level collapsed into prefixes.
         * @param options Listing options; `pageSize` caps a page like a real bucket may.
         */
        list: (options: { delimiter?: string; maxKeys?: number; pageSize?: number; prefix?: string; start?: number }) => {
            const prefix = options.prefix ?? "";
            const prefixes = new Set<string>();
            const contents: string[] = [];

            for (const name of [...objects.keys()].filter((key) => key.startsWith(prefix)).toSorted()) {
                const cut = options.delimiter ? name.indexOf(options.delimiter, prefix.length) : -1;

                if (cut === -1) {
                    contents.push(name);
                } else {
                    prefixes.add(name.slice(0, cut + 1));
                }
            }

            const start = options.start ?? 0;
            const end = start + Math.min(options.maxKeys ?? 1000, options.pageSize ?? Number.POSITIVE_INFINITY);

            return {
                contents: contents.slice(start, end).map((key) => {
                    return { key, lastModified: objects.get(key)?.lastModified };
                }),
                next: end < contents.length ? end : undefined,
                prefixes: [...prefixes],
            };
        },

        objects,
        parts,
        put,

        /** Stores a part; `undefined` when there is no such upload. */
        putPart: (uploadId: string, partNumber: number, body: Buffer): string | undefined => {
            const upload = uploads.get(uploadId);

            if (!upload) {
                return undefined;
            }

            const part = { body, etag: etag() };

            upload.parts.set(partNumber, part);

            return part.etag;
        },

        /** An object and the bytes of `range` (`bytes=a-b`), or `undefined` when it is missing. */
        read: (key: string, range?: string | null): { body: Buffer; object: S3Object; partial: boolean } | undefined => {
            const object = objects.get(key);

            if (!object) {
                return undefined;
            }

            const match = /^bytes=(\d+)-(\d*)$/u.exec(range ?? "");
            const end = match?.[2] ? Number(match[2]) + 1 : undefined;

            return { body: match ? object.body.subarray(Number(match[1]), end) : object.body, object, partial: match !== null };
        },

        uploads,
    };
};

export type S3State = ReturnType<typeof createS3State>;
