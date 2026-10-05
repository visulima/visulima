import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import MetaStorage, { rethrowNotFound, setMetaVersion } from "../meta-storage";
import type { File } from "../utils/file";
import { parseMetaRecord } from "./s3-utils";
import type { S3MetaStorageOptions } from "./types";

/**
 * Whether an S3 error is a failed conditional write: 412 when the ETag no longer matches (or the
 * object is gone), 409 when another conditional write to the key was in flight.
 */
const isConditionalWriteConflict = (error: unknown): boolean => {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

    return status === 412 || status === 409;
};

class S3MetaStorage<T extends File = File> extends MetaStorage<T> {
    /**
     * Uses `If-Match` conditional writes. An S3-compatible service that ignores the header
     * degrades to plain overwrites, as before.
     */
    public override readonly supportsConditionalSave: boolean = true;

    /** The bucket the records are stored in. */
    public readonly bucket: string;

    private readonly client: S3Client;

    public constructor(public config: S3MetaStorageOptions) {
        super(config);

        const { client, ...metaConfig } = config;
        const bucket = metaConfig.bucket || process.env.S3_BUCKET;

        if (client === undefined) {
            if (!bucket) {
                throw new Error("S3 bucket is not defined");
            }

            const keyFile = metaConfig.keyFile || process.env.S3_KEYFILE;

            if (keyFile) {
                metaConfig.credentials = fromIni({ configFilepath: keyFile });
            }

            this.client = new S3Client(metaConfig);
        } else {
            this.client = client;
        }

        this.bucket = bucket as string;

        if (client === undefined) {
            // A single HEAD fails fast; `waitUntilBucketExists` would poll for up to 30s per failing operation.
            this.accessProbe = async () => {
                await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
            };
        }
    }

    public override async get(id: string): Promise<T> {
        await this.ensureAccess();

        const parameters = { Bucket: this.bucket, Key: this.getMetaName(id) };
        const { Body, ETag, Metadata } = await this.client.send(new GetObjectCommand(parameters)).catch(rethrowNotFound);
        const file = parseMetaRecord<T>((await Body?.transformToString()) ?? "", Metadata?.metadata);

        if (file !== undefined) {
            setMetaVersion(file, ETag);

            return file;
        }

        return throwErrorCode(ERRORS.FILE_NOT_FOUND, `Metafile ${id} not found`);
    }

    public override async touch(id: string, file: T): Promise<T> {
        return this.save(id, file);
    }

    public override async delete(id: string): Promise<void> {
        await this.ensureAccess();

        const parameters = { Bucket: this.bucket, Key: this.getMetaName(id) };

        await this.client.send(new DeleteObjectCommand(parameters));
    }

    public override async save(id: string, file: T): Promise<T> {
        await this.put(id, file);

        return file;
    }

    public override async saveIfVersion(id: string, file: T, version: string): Promise<T | undefined> {
        try {
            await this.put(id, file, version);
        } catch (error) {
            if (isConditionalWriteConflict(error)) {
                return undefined;
            }

            throw error;
        }

        return file;
    }

    private async put(id: string, file: T, ifMatch?: string): Promise<void> {
        await this.ensureAccess();

        // The record is the object's body, so its ETag (the body's MD5) changes with it and If-Match
        // detects a concurrent save; a header record left the empty body, and its ETag, unchanged.
        const parameters = {
            Body: JSON.stringify(file),
            Bucket: this.bucket,
            ContentType: "application/json",
            IfMatch: ifMatch,
            Key: this.getMetaName(id),
        };

        const result = await this.client.send(new PutObjectCommand(parameters));

        setMetaVersion(file, result?.ETag);
    }
}

export default S3MetaStorage;
