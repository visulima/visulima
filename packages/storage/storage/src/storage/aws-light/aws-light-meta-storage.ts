import MetaStorage, { setMetaVersion } from "../meta-storage";
import type { File } from "../utils/file";
import { isExpired } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";
import AwsLightApiAdapter from "./aws-light-api-adapter";
import type { AwsLightMetaStorageOptions } from "./types";

/**
 * AWS Light meta storage implementation using aws4fetch.
 * Stores metadata in S3 object metadata headers (x-amz-meta-*).
 * Optimized for worker environments (Cloudflare Workers, Web Workers, etc.).
 */
class AwsLightMetaStorage<T extends File = File> extends MetaStorage<T> {
    /**
     * Uses `If-Match` conditional writes (S3, R2, MinIO). A service that ignores the header
     * degrades to plain overwrites, as before.
     */
    public override readonly supportsConditionalSave: boolean = true;

    private readonly adapter: AwsLightApiAdapter;

    private readonly bucket: string;

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

        const Key = this.getMetaName(id);
        const { ETag, Expires, Metadata } = await this.adapter.headObject({
            Bucket: this.bucket,
            Key,
        });

        if (Expires && isExpired({ expiredAt: Expires } as T)) {
            await this.delete(Key);

            throw new Error(`Metafile ${id} not found`);
        }

        if (Metadata?.metadata !== undefined) {
            const file = JSON.parse(decodeURIComponent(Metadata.metadata)) as T;

            if (file.metadata && typeof file.metadata === "string") {
                file.metadata = parseMetadata(file.metadata);
            }

            setMetaVersion(file, ETag);

            return file;
        }

        throw new Error(`Metafile ${id} not found`);
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

        const transformedMetadata = { ...file } as unknown as Omit<T, "metadata"> & { metadata?: string };

        if (transformedMetadata.metadata) {
            transformedMetadata.metadata = stringifyMetadata(file.metadata);
        }

        const metadata = encodeURIComponent(JSON.stringify(transformedMetadata));
        const result = await this.adapter.putObject({
            Bucket: this.bucket,
            ContentLength: 0,
            ContentType: "application/json",
            IfMatch: ifMatch,
            Key: this.getMetaName(id),
            Metadata: { metadata },
        });

        setMetaVersion(file, result?.ETag);
    }
}

export default AwsLightMetaStorage;
