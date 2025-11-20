import MetaStorage from "../meta-storage";
import type { File } from "../utils/file";
import { isExpired } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";
import { AwsLightApiAdapter } from "./aws-light-api-adapter";
import type { AwsLightMetaStorageOptions } from "./types";

/**
 * AWS Light meta storage implementation using aws4fetch.
 * Stores metadata in S3 object metadata headers (x-amz-meta-*).
 * Optimized for worker environments (Cloudflare Workers, Web Workers, etc.).
 */
class AwsLightMetaStorage<T extends File = File> extends MetaStorage<T> {
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

        // Check bucket access
        this.adapter.checkBucketAccess({ Bucket: bucket }).catch((error) => {
            throw error;
        });
    }

    public override async get(id: string): Promise<T> {
        const Key = this.getMetaName(id);
        const { Expires, Metadata } = await this.adapter.headObject({
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

            return file;
        }

        throw new Error(`Metafile ${id} not found`);
    }

    public override async touch(id: string, file: T): Promise<T> {
        return this.save(id, file);
    }

    public override async delete(id: string): Promise<void> {
        await this.adapter.deleteObject({
            Bucket: this.bucket,
            Key: this.getMetaName(id),
        });
    }

    public override async save(id: string, file: T): Promise<T> {
        const transformedMetadata = { ...file } as unknown as Omit<T, "metadata"> & { metadata?: string };

        if (transformedMetadata.metadata) {
            transformedMetadata.metadata = stringifyMetadata(file.metadata);
        }

        const metadata = encodeURIComponent(JSON.stringify(transformedMetadata));

        await this.adapter.putObject({
            Bucket: this.bucket,
            ContentLength: 0,
            ContentType: "application/json",
            Key: this.getMetaName(id),
            Metadata: { metadata },
        });

        return file;
    }
}

export default AwsLightMetaStorage;

