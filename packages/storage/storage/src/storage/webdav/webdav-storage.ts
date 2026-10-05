import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import etag from "etag";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import { toHttpDate } from "../../utils/headers";
import type MetaStorage from "../meta-storage";
import { BaseStorage } from "../storage";
import type { ConditionalOptions, ConditionalSupport, CopyConditionalOptions, OperationOptions, StoredObject } from "../types";
import { hasCondition, quoteETag } from "../utils/etag";
import type { FileInit, FilePart, FileQuery, FileReturn } from "../utils/file";
import { getFileStatus, hasContent, partMatch, updateSize } from "../utils/file";
import { collectStream, posixDirname, trimSlashes } from "../utils/remote";
import type { WebdavStorageOptions } from "./types";
import WebdavFile from "./webdav-file";
import WebdavMetaStorage from "./webdav-meta-storage";

type RangeOptions = ConditionalOptions & OperationOptions & { range?: { end?: number; start: number } };

interface DavEntry {
    contentType?: string;
    etag?: string;
    isCollection: boolean;
    modifiedAt?: string;
    /** Path relative to the endpoint URL, decoded, without leading/trailing slashes. */
    path: string;
    size?: number;
}

const PROPFIND_BODY =
    "<?xml version=\"1.0\" encoding=\"utf-8\"?><d:propfind xmlns:d=\"DAV:\"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/><d:getetag/></d:prop></d:propfind>";

const decodeEntities = (value: string): string =>
    value.replaceAll(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (_match, entity: string) => {
        const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: "\"" };
        const lower = entity.toLowerCase();

        if (lower.startsWith("#x")) {
            return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
        }

        if (lower.startsWith("#")) {
            return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
        }

        return named[lower] as string;
    });

/** Text of the first `name` element (with any namespace prefix), or `undefined`. */
const elementText = (xml: string, name: string): string | undefined => {
    const match = new RegExp(String.raw`<(?:[\w.-]+:)?${name}\b[^>]*?(?:/>|>([\s\S]*?)</(?:[\w.-]+:)?${name}\s*>)`, "iu").exec(xml);

    if (!match) {
        return undefined;
    }

    const text = decodeEntities((match[1] ?? "").trim());

    return text || undefined;
};

/** Status code of a `&lt;status>` line (`HTTP/1.1 404 Not Found`), or `undefined`. */
const statusCodeOf = (line: string | undefined): number | undefined => {
    const match = /^\S+\s+(\d{3})\b/u.exec(line ?? "");

    return match ? Number(match[1]) : undefined;
};

const isSuccess = (status: number): boolean => status >= 200 && status < 300;

const PROPSTAT = /<(?:[\w.-]+:)?propstat\b[\s\S]*?<\/(?:[\w.-]+:)?propstat\s*>/giu;

/** `If-Match` / `If-None-Match` request headers of a predicate. */
const conditionHeaders = (condition: ConditionalOptions | undefined): Record<string, string> => {
    return {
        ...(condition?.ifMatch !== undefined && { "If-Match": quoteETag(condition.ifMatch) }),
        ...(condition?.ifNoneMatch !== undefined && { "If-None-Match": condition.ifNoneMatch }),
    };
};

/** Error carrying the HTTP status, so the retry policy treats 5xx/429 as transient; 412 is a failed predicate. */
const httpError = async (response: Response, method: string, path: string): Promise<Error> => {
    await response.body?.cancel().catch(() => undefined);

    if (response.status === 412) {
        return throwErrorCode(ERRORS.PRECONDITION_FAILED, `WebDAV ${method} /${path}: precondition failed`);
    }

    return Object.assign(new Error(`WebDAV ${method} /${path} failed: ${String(response.status)} ${response.statusText}`.trim()), {
        statusCode: response.status,
    });
};

/**
 * A 207 to COPY / MOVE / DELETE reports members that failed (RFC 4918 §9.6.1, §9.8.5, §9.9.4): the
 * operation did not fully happen. Fails with the first non-2xx status it lists.
 */
const multistatusError = async (response: Response, method: string, path: string): Promise<Error> => {
    const xml = await response.text();
    const statuses = [...xml.matchAll(/<(?:[\w.-]+:)?status\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?status\s*>/giu)].map(([, line]) => statusCodeOf(line?.trim()));
    // The 3xx-5xx a Response can carry; anything else reads as a server failure.
    const failed = statuses.find((status) => status !== undefined && status >= 300 && status <= 599);

    return httpError(new Response(null, { status: failed ?? 500, statusText: "Multi-Status" }), method, path);
};

const toFile = (key: string, entry: DavEntry): WebdavFile => {
    const file = new WebdavFile({
        contentType: entry.contentType ?? "application/octet-stream",
        metadata: {},
        originalName: key.split("/").pop() ?? key,
        size: entry.size,
    });

    return Object.assign(file, {
        bytesWritten: entry.size ?? 0,
        ETag: entry.etag,
        id: key,
        modifiedAt: entry.modifiedAt,
        name: key,
        path: entry.path,
        status: "completed" as const,
    });
};

/**
 * WebDAV storage backend (Nextcloud, ownCloud, Apache `mod_dav`, nginx, rclone serve, …),
 * implemented on plain `fetch` with `PROPFIND`/`PUT`/`GET`/`DELETE`/`COPY`/`MOVE`/`MKCOL`.
 *
 * Keys map onto paths under `rootFolderPath`, relative to `url`. WebDAV has no portable
 * metadata store, so upload metadata is kept as sidecar JSON on the local disk (see
 * `WebdavMetaStorage`).
 *
 * **Limitations**:
 * - Partial `PUT` is not part of WebDAV (RFC 4918), so only a whole-file write at offset 0 is accepted; chunked writes are rejected with `METHOD_NOT_ALLOWED`. `write()` buffers the part in memory.
 * - `getReadUrl` / `getUploadUrl` are not supported — a WebDAV `GET` needs credentials that can't be signed into a URL.
 */
class WebdavStorage extends BaseStorage<WebdavFile> {
    public static override readonly name: string = "webdav";

    /** Stores each object in a single request, so chunked/resumable uploads are rejected. */
    public override readonly supportsResumableWrites: boolean = false;

    public override checksumTypes: string[] = [];

    public override readonly supportsRange: boolean = true;

    /** Every predicate goes to the server as request headers; opt-in through the `conditional` option. */
    public override readonly conditionalSupport: ConditionalSupport;

    protected meta: MetaStorage<WebdavFile>;

    private readonly baseUrl: URL;

    private readonly basePath: string;

    private readonly headers: Record<string, string>;

    private readonly rootFolderPath: string;

    public constructor(config: WebdavStorageOptions) {
        super(config);

        const url = config.url ?? process.env.WEBDAV_URL;

        if (!url) {
            throw new Error("WebDAV storage requires a `url` (or the WEBDAV_URL environment variable).");
        }

        this.baseUrl = new URL(url.endsWith("/") ? url : `${url}/`);
        this.basePath = trimSlashes(decodeURIComponent(this.baseUrl.pathname));
        this.rootFolderPath = trimSlashes(config.rootFolderPath ?? "");

        const token = config.token ?? process.env.WEBDAV_TOKEN;
        const username = config.username ?? process.env.WEBDAV_USERNAME;
        const password = config.password ?? process.env.WEBDAV_PASSWORD;

        this.headers = { ...config.headers };

        if (token) {
            this.headers.Authorization = `Bearer ${token}`;
        } else if (username !== undefined) {
            this.headers.Authorization = `Basic ${Buffer.from(`${username}:${password ?? ""}`).toString("base64")}`;
        }

        this.meta = config.metaStorage ?? new WebdavMetaStorage(config.metaStorageConfig);

        const conditional = config.conditional === true;

        this.conditionalSupport = { copy: conditional, create: conditional, delete: conditional, read: conditional, replace: conditional };

        this.isReady = true;
    }

    public async create(config: FileInit, options?: ConditionalOptions & OperationOptions): Promise<WebdavFile> {
        return this.instrumentOperation("create", async () => {
            const file = new WebdavFile(config);

            file.name = this.namingFunction(file);
            file.path = this.keyToPath(file.name);

            await this.validate(file);

            // A conditional upload leaves the stored file and record alone: the server evaluates the
            // predicate on the PUT, and the record is only saved once that succeeded.
            if (hasCondition(options)) {
                file.bytesWritten = 0;
                file.status = getFileStatus(file);
                // Parked only once onCreate accepted it: a parked record nothing takes locks its key.
                await this.onCreate(file);
                this.parkConditional(file);

                return file;
            }

            // Writes go out in one request, so nothing is resumed: a create replaces the stored upload.
            // Its record is read anyway, so a meta store that fails never has the upload written over.
            await this.findMeta(file.id);

            file.bytesWritten = 0;
            file.status = getFileStatus(file);

            await this.saveMeta(file);
            await this.onCreate(file);

            return file;
        });
    }

    public async write(part: FilePart | FileQuery | WebdavFile, options?: ConditionalOptions & OperationOptions): Promise<WebdavFile> {
        return this.instrumentOperation("write", async () => {
            const conditional = this.takeConditional(part.id, options);
            let file: WebdavFile;

            if (conditional) {
                file = conditional;
            } else if ("contentType" in part && "metadata" in part && !("body" in part) && !("start" in part)) {
                file = part;
            } else {
                file = await this.getMeta(part.id);
                await this.checkIfExpired(file);
            }

            if (file.status === "completed") {
                return file;
            }

            if (part.size !== undefined) {
                updateSize(file, part.size);
            }

            if (!partMatch(part, file)) {
                return throwErrorCode(ERRORS.FILE_CONFLICT);
            }

            const lockToken = await this.lock(part.id);

            try {
                if (hasContent(part)) {
                    if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
                        return throwErrorCode(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
                    }

                    // WebDAV PUT replaces the whole resource; a non-initial chunk would
                    // overwrite earlier bytes and silently lose data.
                    this.assertWholeFileWrite(part, file);

                    const buffer = await collectStream(part.body);

                    this.assertWholeFileWrite(part, file, buffer.byteLength);

                    const path = file.path ?? this.keyToPath(file.name || file.id);

                    // `buffer` is fully materialized, so a retried attempt re-sends the same bytes.
                    const stored = await this.runOperation(options, (signal) =>
                        this.put(path, buffer, file.contentType, signal, conditional ? conditionHeaders(options) : undefined),
                    );

                    file.bytesWritten = buffer.length;
                    file.size = buffer.length;
                    file.path = path;
                    // Predicates compare against the server's validator, so report that one when they are on.
                    file.ETag = stored ?? (this.conditionalSupport.replace ? await this.storedETag(file.name, options) : undefined) ?? etag(buffer);
                }

                file.status = getFileStatus(file);

                await this.saveMeta(file);

                return file;
            } finally {
                await this.unlock(part.id, lockToken);
            }
        });
    }

    public async get({ id }: FileQuery, options?: RangeOptions): Promise<FileReturn> {
        return this.instrumentOperation("get", async () => {
            this.assertConditionSupported("read", options);

            const file = await this.checkIfExpired(await this.getMeta(id));
            const path = file.path ?? this.keyToPath(file.name || id);
            const { range } = options ?? {};

            const { content, served } = await this.runOperation(options, async (signal) => {
                const response = await this.download(path, range, signal, options);
                const buffer = Buffer.from(await response.arrayBuffer());
                const tag = response.headers.get("etag") ?? undefined;

                if (!range || response.status === 206) {
                    return { content: buffer, served: tag };
                }

                // A server that ignores `Range` answers 200 with the whole body; slice it here.
                return { content: buffer.subarray(range.start, range.end === undefined ? undefined : range.end + 1), served: tag };
            });

            return {
                content,
                contentType: file.contentType,
                // The server's validator, when it sends one, is the one conditional requests compare against.
                ETag: (this.conditionalSupport.read ? served : undefined) ?? file.ETag ?? etag(content),
                expiredAt: file.expiredAt,
                id,
                metadata: file.metadata,
                modifiedAt: file.modifiedAt,
                name: file.name,
                originalName: file.originalName,
                size: range ? content.length : (file.size ?? content.length),
            };
        });
    }

    public override async getStream(
        { id }: FileQuery,
        options?: RangeOptions,
    ): Promise<{ headers?: Record<string, string>; size?: number; stream: Readable }> {
        return this.instrumentOperation("getStream", async () => {
            this.assertConditionSupported("read", options);

            const file = await this.checkIfExpired(await this.getMeta(id));
            const path = file.path ?? this.keyToPath(file.name || id);
            const range = options?.range;
            const response = await this.runOperation(options, (signal) => this.download(path, range, signal, options));

            if ((range && response.status !== 206) || !response.body) {
                // Range ignored by the server: let `get` slice the full body.
                await response.body?.cancel().catch(() => undefined);

                return super.getStream({ id }, options);
            }

            const length = response.headers.get("content-length");
            let size = length === null ? file.size : Number(length);

            if (length === null && range && file.size !== undefined) {
                size = Math.min(range.end ?? file.size - 1, file.size - 1) - range.start + 1;
            }

            return {
                headers: {
                    "Content-Type": file.contentType,
                    ...(size !== undefined && { "Content-Length": String(size) }),
                    ...(file.ETag && { ETag: file.ETag }),
                    ...(file.modifiedAt && { "Last-Modified": toHttpDate(file.modifiedAt) }),
                },
                size,
                stream: Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>),
            };
        });
    }

    public async delete({ id }: FileQuery, options?: ConditionalOptions & OperationOptions): Promise<WebdavFile> {
        return this.instrumentOperation("delete", async () => {
            this.assertConditionSupported("delete", options);

            const file = await this.getMeta(id);
            const path = file.path ?? this.keyToPath(file.name || id);

            await this.runOperation(options, async (signal) => {
                const response = await this.request("DELETE", path, signal, { headers: conditionHeaders({ ifMatch: options?.ifMatch }) });

                // Idempotent: an already-missing resource is not an error, unless a predicate expected one.
                if (response.status === 404 && options?.ifMatch !== undefined) {
                    await response.body?.cancel().catch(() => undefined);

                    throwErrorCode(ERRORS.PRECONDITION_FAILED, "There is no stored file to match");
                }

                if (response.status === 207) {
                    throw await multistatusError(response, "DELETE", path);
                }

                if (!response.ok && response.status !== 404) {
                    throw await httpError(response, "DELETE", path);
                }

                await response.body?.cancel().catch(() => undefined);
            });

            await this.deleteMeta(id);

            const deletedFile = { ...file, status: "deleted" } as WebdavFile;

            await this.onDelete(deletedFile);

            return deletedFile;
        });
    }

    public async copy(name: string, destination: string, options?: CopyConditionalOptions & OperationOptions & { storageClass?: string }): Promise<WebdavFile> {
        return this.instrumentOperation("copy", async () => {
            this.assertConditionSupported("copy", { ifMatch: options?.sourceIfMatch ?? options?.ifMatch, ifNoneMatch: options?.ifNoneMatch });

            const sourceFile = await this.getMeta(name);
            const sourcePath = sourceFile.path ?? this.keyToPath(sourceFile.name || name);
            const targetPath = this.keyToPath(destination);
            const { ifMatch, ifNoneMatch, sourceIfMatch } = options ?? {};
            // `If-Match` applies to the request URI, the source. The destination is conditioned by
            // `Overwrite: F` (create-only) or a tagged `If` header (RFC 4918 §10.4).
            const headers: Record<string, string> = {
                ...conditionHeaders({ ifMatch: sourceIfMatch }),
                ...(ifNoneMatch !== undefined && { Overwrite: "F" }),
                ...(ifMatch !== undefined && { If: `<${this.toUrl(targetPath)}> ([${quoteETag(ifMatch)}])` }),
            };

            await this.runOperation(options, (signal) => this.transfer("COPY", sourcePath, targetPath, signal, headers));

            const copiedFile = { ...sourceFile, id: destination, name: destination, path: targetPath } as WebdavFile;

            // The copy is a new resource with its own validator.
            if (this.conditionalSupport.copy) {
                copiedFile.ETag = await this.storedETag(destination, options);
            }

            await this.saveMeta(copiedFile);

            return copiedFile;
        });
    }

    public async move(name: string, destination: string, options?: OperationOptions): Promise<WebdavFile> {
        return this.instrumentOperation("move", async () => {
            const sourceFile = await this.getMeta(name);
            const sourcePath = sourceFile.path ?? this.keyToPath(sourceFile.name || name);
            const targetPath = this.keyToPath(destination);

            await this.runOperation(options, (signal) => this.transfer("MOVE", sourcePath, targetPath, signal));

            const movedFile = { ...sourceFile, id: destination, name: destination, path: targetPath } as WebdavFile;

            await this.saveMeta(movedFile);

            try {
                await this.deleteMeta(name);
            } catch {
                // ignore
            }

            return movedFile;
        });
    }

    /**
     * Walks the tree under `rootFolderPath` with `Depth: 1` PROPFINDs (`Depth: infinity` is
     * disabled on most servers), stopping once `limit` files are collected.
     */
    public override async list(limit = 1000, options?: OperationOptions): Promise<WebdavFile[]> {
        return this.instrumentOperation("list", async () => {
            const files: WebdavFile[] = [];
            const queue = [this.keyToPath("")];
            const { suffix } = this.meta;

            while (queue.length > 0 && files.length < limit) {
                const directory = queue.shift() as string;
                const entries = await this.runOperation(options, (signal) => this.propfind(directory, "1", signal));

                for (const entry of entries ?? []) {
                    if (entry.path === directory) {
                        continue;
                    }

                    if (entry.isCollection) {
                        queue.push(entry.path);

                        continue;
                    }

                    const key = this.pathToKey(entry.path);

                    if (!key || (suffix && key.endsWith(suffix))) {
                        continue;
                    }

                    files.push(toFile(key, entry));
                }
            }

            return files.slice(0, limit);
        });
    }

    /**
     * Describes the remote file stored under a key (only its properties are requested).
     * @param id Remote key.
     * @param options Operation options.
     * @returns The file, or `undefined` when the server answers 404 or the path is a collection.
     */
    protected override async statObject(id: string, options?: OperationOptions): Promise<StoredObject | undefined> {
        const path = this.keyToPath(id);
        const [entry] = (await this.runOperation(options, (signal) => this.propfind(path, "0", signal))) ?? [];

        if (!entry || entry.isCollection) {
            return undefined;
        }

        return { contentType: entry.contentType, etag: entry.etag, extra: { modifiedAt: entry.modifiedAt, path: entry.path }, size: entry.size ?? 0 };
    }

    /** Asks the server for the file's ETag: the record's may predate a write by another client. */
    protected override async currentETag(file: WebdavFile, options?: OperationOptions): Promise<string | undefined> {
        return this.storedETag(file.name, options);
    }

    public override async exists({ id }: FileQuery, options?: OperationOptions): Promise<boolean> {
        return this.instrumentOperation("exists", async () => {
            const file = await this.findMeta(id);

            if (file === undefined) {
                return false;
            }

            const path = file.path ?? this.keyToPath(file.name || id);
            const [entry] = (await this.runOperation(options, (signal) => this.propfind(path, "0", signal))) ?? [];

            return entry !== undefined && !entry.isCollection;
        });
    }

    /**
     * Refuses a predicate this adapter would not enforce: with `conditional` off, the headers
     * reach servers that may ignore them, turning a compare-and-set into a plain write.
     * @param kind Kind of operation
     * @param options Predicates of the call
     */
    private assertConditionSupported(kind: keyof ConditionalSupport, options: ConditionalOptions | undefined): void {
        if (hasCondition(options) && !this.conditionalSupport[kind]) {
            throwErrorCode(ERRORS.METHOD_NOT_ALLOWED, `WebdavStorage was created without \`conditional: true\`; it does not enforce conditional ${kind}`);
        }
    }

    private async request(method: string, path: string, signal: AbortSignal | undefined, init?: { body?: BodyInit; headers?: Record<string, string> }): Promise<Response> {
        return fetch(this.toUrl(path), {
            body: init?.body,
            headers: { ...this.headers, ...init?.headers },
            method,
            signal,
        });
    }

    private async download(path: string, range: RangeOptions["range"], signal: AbortSignal | undefined, condition?: ConditionalOptions): Promise<Response> {
        const response = await this.request("GET", path, signal, {
            headers: {
                ...conditionHeaders({ ifMatch: condition?.ifMatch }),
                ...(range && { Range: `bytes=${String(range.start)}-${range.end === undefined ? "" : String(range.end)}` }),
            },
        });

        if (response.status === 404) {
            await response.body?.cancel().catch(() => undefined);

            return throwErrorCode(ERRORS.FILE_NOT_FOUND);
        }

        if (!response.ok) {
            throw await httpError(response, "GET", path);
        }

        return response;
    }

    /**
     * PUT, creating the missing parent collections when the server answers 409 (RFC 4918 §9.7.1).
     * @returns The ETag the server answered with, if any.
     */
    private async put(path: string, body: Buffer, contentType: string, signal: AbortSignal | undefined, headers?: Record<string, string>): Promise<string | undefined> {
        const send = async (): Promise<Response> =>
            this.request("PUT", path, signal, { body: new Uint8Array(body), headers: { "Content-Type": contentType, ...headers } });

        let response = await send();

        if (response.status === 409) {
            await response.body?.cancel().catch(() => undefined);
            await this.ensureCollections(path, signal);
            response = await send();
        }

        if (!response.ok) {
            throw await httpError(response, "PUT", path);
        }

        await response.body?.cancel().catch(() => undefined);

        return response.headers.get("etag") ?? undefined;
    }

    /** Server-side COPY / MOVE with overwrite, creating missing parent collections of the target. */
    private async transfer(method: "COPY" | "MOVE", from: string, to: string, signal: AbortSignal | undefined, headers?: Record<string, string>): Promise<void> {
        const send = async (): Promise<Response> =>
            this.request(method, from, signal, { headers: { Destination: this.toUrl(to), Overwrite: "T", ...headers } });

        let response = await send();

        if (response.status === 409) {
            await response.body?.cancel().catch(() => undefined);
            await this.ensureCollections(to, signal);
            response = await send();
        }

        if (response.status === 404) {
            await response.body?.cancel().catch(() => undefined);

            throwErrorCode(ERRORS.FILE_NOT_FOUND);
        }

        if (response.status === 207) {
            throw await multistatusError(response, method, from);
        }

        if (!response.ok) {
            throw await httpError(response, method, from);
        }

        await response.body?.cancel().catch(() => undefined);
    }

    /** MKCOL every ancestor collection of `path`, top-down; 405 means it already exists. */
    private async ensureCollections(path: string, signal: AbortSignal | undefined): Promise<void> {
        const directory = posixDirname(path);
        let current = "";

        for (const segment of directory ? directory.split("/") : []) {
            current = current ? `${current}/${segment}` : segment;

            const response = await this.request("MKCOL", `${current}/`, signal);

            if (!response.ok && response.status !== 405) {
                throw await httpError(response, "MKCOL", current);
            }

            await response.body?.cancel().catch(() => undefined);
        }
    }

    /**
     * PROPFIND `path` at the given depth.
     * @returns The entries, or `undefined` when the resource does not exist (404). Other failures throw.
     */
    private async propfind(path: string, depth: "0" | "1", signal: AbortSignal | undefined): Promise<DavEntry[] | undefined> {
        const target = depth === "1" && path ? `${path}/` : path;
        const response = await this.request("PROPFIND", target, signal, {
            body: PROPFIND_BODY,
            headers: { "Content-Type": "application/xml; charset=utf-8", Depth: depth },
        });

        if (response.status === 404) {
            await response.body?.cancel().catch(() => undefined);

            return undefined;
        }

        if (response.status !== 207) {
            throw await httpError(response, "PROPFIND", path);
        }

        return this.parseMultistatus(await response.text(), this.toUrl(target));
    }

    /**
     * Entries of a PROPFIND multistatus.
     * @param xml Response body
     * @param requestUrl URL the PROPFIND went to: a relative href resolves against it (RFC 4918 §8.3)
     * @returns The entries; one that can't be read is left out rather than failing the listing
     */
    private parseMultistatus(xml: string, requestUrl: string): DavEntry[] {
        const entries: DavEntry[] = [];

        for (const [, body = ""] of xml.matchAll(/<(?:[\w.-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?response\s*>/giu)) {
            const href = elementText(body, "href");
            // A <status> of the response itself, not of a propstat, reports the resource failed (RFC 4918 §14.24).
            const status = statusCodeOf(elementText(body.replaceAll(PROPSTAT, ""), "status"));

            if (!href || (status !== undefined && !isSuccess(status))) {
                continue;
            }

            let fullPath: string;

            try {
                fullPath = trimSlashes(decodeURIComponent(new URL(href, requestUrl).pathname));
            } catch {
                // A malformed href (bad percent-encoding) names no resource we could address.
                continue;
            }

            if (this.basePath && fullPath !== this.basePath && !fullPath.startsWith(`${this.basePath}/`)) {
                continue;
            }

            const size = Number(elementText(body, "getcontentlength") ?? Number.NaN);
            const modified = Date.parse(elementText(body, "getlastmodified") ?? "");

            entries.push({
                contentType: elementText(body, "getcontenttype"),
                etag: elementText(body, "getetag"),
                isCollection: /<(?:[\w.-]+:)?collection\b/iu.test(elementText(body, "resourcetype") ?? ""),
                modifiedAt: Number.isNaN(modified) ? undefined : new Date(modified).toISOString(),
                path: this.basePath ? fullPath.slice(this.basePath.length + 1) : fullPath,
                size: Number.isNaN(size) ? undefined : size,
            });
        }

        return entries;
    }

    private toUrl(path: string): string {
        return new URL(path.split("/").map((segment) => encodeURIComponent(segment)).join("/"), this.baseUrl).href;
    }

    private keyToPath(key: string): string {
        const inner = trimSlashes(key);

        if (inner) {
            BaseStorage.assertSafeId(inner);
        }

        return [this.rootFolderPath, inner].filter(Boolean).join("/");
    }

    private pathToKey(path: string): string {
        if (!this.rootFolderPath) {
            return path;
        }

        const prefix = `${this.rootFolderPath}/`;

        return path.startsWith(prefix) ? path.slice(prefix.length) : "";
    }
}

export default WebdavStorage;
