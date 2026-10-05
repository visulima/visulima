import { text } from "node:stream/consumers";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import { parseMetaRecord } from "../aws/s3-utils";
import MetaStorage, { rethrowNotFound, setMetaVersion } from "../meta-storage";
import type { File } from "../utils/file";
import AwsLightApiAdapter from "./aws-light-api-adapter";
import type { AwsLightMetaStorageOptions } from "./types";

/**
 * AWS Light meta storage implementation using aws4fetch.
 * Stores each record as the JSON body of an object next to the upload.
 * Optimized for worker environments (Cloudflare Workers, Web Workers, etc.).
 */
class AwsLightMetaStorage<T extends File = File> extends MetaStorage<T> {
    /**
     * Uses `If-Match` conditional writes (S3, R2, MinIO). A service that ignores the header
     * degrades to plain overwrites, as before.
     */
    public override readonly supportsConditionalSave: boolean = true;

    private readonly adapter: AwsLightApiAdapter;

    /** The bucket the records are stored in. */
    public readonly bucket: string;

    public constructor(public config: AwsLightMetaStorageOptions) {
        super(config);

        const bucket = config.bucket || process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;

        if (!bucket) {
            throw new Error("S3 bucket is not defined");
        }

        this.bucket = bucket;

        this.adapter = new AwsLightApiAdapter({
            accessKeyId: config.accessKeyId,
            bucket,
            endpoint: config.endpoint,
            region: config.region,
            secretAccessKey: config.secretAccessKey,
            service: config.service,
            sessionToken: config.sessionToken,
        });

        this.accessProbe = async () => this.adapter.checkBucketAccess({ Bucket: this.bucket });
    }

    public override async get(id: string): Promise<T> {
        await this.ensureAccess();

        const { Body, ETag, Metadata } = await this.adapter
            .getObject({
                Bucket: this.bucket,
                Key: this.getMetaName(id),
            })
            .catch(rethrowNotFound);
        const file = parseMetaRecord<T>(Body === undefined ? "" : await text(Body), Metadata?.metadata);

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

        await this.adapter.deleteObject({
            Bucket: this.bucket,
            Key: this.getMetaName(id),
        });
    }

    public override async save(id: string, file: T): Promise<T> {
        await this.put(id, file);

        return file;
    }

    public override async saveIfVersion(id: string, file: T, version: string): Promise<T | undefined> {
        try {
            await this.put(id, file, version);
        } catch (error) {
            // 412: the ETag no longer matches (or the object is gone); 409: a concurrent conditional write.
            const { statusCode } = error as { statusCode?: number };

            if (statusCode === 412 || statusCode === 409) {
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
        const result = await this.adapter.putObject({
            Body: new TextEncoder().encode(JSON.stringify(file)),
            Bucket: this.bucket,
            ContentType: "application/json",
            IfMatch: ifMatch,
            Key: this.getMetaName(id),
        });

        setMetaVersion(file, result?.ETag);
    }
}

export default AwsLightMetaStorage;
