// eslint-disable-next-line import/no-extraneous-dependencies
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, waitUntilBucketExists } from "@aws-sdk/client-s3";
// eslint-disable-next-line import/no-extraneous-dependencies
import { fromIni } from "@aws-sdk/credential-providers";

import MetaStorage from "../meta-storage";
import type { File} from "../utils/file";
import { isExpired } from "../utils/file";
import type { S3MetaStorageOptions } from "./types";

class S3MetaStorage<T extends File = File> extends MetaStorage<T> {
    private readonly bucket: string;

    private readonly client: S3Client;

    constructor(public config: S3MetaStorageOptions) {
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

            this.accessCheck(bucket).catch((error) => {
                throw error;
            });
        } else {
            this.client = client;
        }

        this.bucket = bucket as string;
    }

    private async accessCheck(bucket: string, maxWaitTime = 30): Promise<any> {
        return waitUntilBucketExists({ client: this.client, maxWaitTime }, { Bucket: bucket });
    }

    public async get(id: string): Promise<T> {
        const Key = this.getMetaName(id);
        const parameters = { Bucket: this.bucket, Key };
        const { Expires, Metadata } = await this.client.send(new HeadObjectCommand(parameters));

        if (Expires && isExpired({ expiredAt: Expires } as T)) {
            await this.delete(Key);

            throw new Error(`Metafile ${id} not found`);
        }

        if (Metadata?.metadata !== undefined) {
            return JSON.parse(decodeURIComponent(Metadata.metadata)) as T;
        }

        throw new Error(`Metafile ${id} not found`);
    }

    public async touch(id: string, file: T): Promise<T> {
        return this.save(id, file);
    }

    public async delete(id: string): Promise<void> {
        const parameters = { Bucket: this.bucket, Key: this.getMetaName(id) };

        await this.client.send(new DeleteObjectCommand(parameters));
    }

    public async save(id: string, file: T): Promise<T> {
        const metadata = encodeURIComponent(JSON.stringify(file));
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
