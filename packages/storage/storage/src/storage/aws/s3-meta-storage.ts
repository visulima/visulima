import { DeleteObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-providers";

import MetaStorage from "../meta-storage";
import type { File } from "../utils/file";
import { isExpired } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";
import type { S3MetaStorageOptions } from "./types";

class S3MetaStorage<T extends File = File> extends MetaStorage<T> {
    private readonly bucket: string;

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

        const Key = this.getMetaName(id);
        const parameters = { Bucket: this.bucket, Key };
        const { Expires, Metadata } = await this.client.send(new HeadObjectCommand(parameters));

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
        await this.ensureAccess();

        const parameters = { Bucket: this.bucket, Key: this.getMetaName(id) };

        await this.client.send(new DeleteObjectCommand(parameters));
    }

    public override async save(id: string, file: T): Promise<T> {
        await this.ensureAccess();

        const transformedMetadata = { ...file } as unknown as Omit<T, "metadata"> & { metadata?: string };

        if (transformedMetadata.metadata) {
            transformedMetadata.metadata = stringifyMetadata(file.metadata);
        }

        const metadata = encodeURIComponent(JSON.stringify(transformedMetadata));
        const parameters = {
            Bucket: this.bucket,
            ContentLength: 0,
            Key: this.getMetaName(id),
            Metadata: { metadata },
        };

        await this.client.send(new PutObjectCommand(parameters));

        return file;
    }
}

export default S3MetaStorage;
