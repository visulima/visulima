// eslint-disable-next-line import/no-extraneous-dependencies
import type { _Object, ListObjectsV2CommandInput } from "@aws-sdk/client-s3";
// eslint-disable-next-line import/no-extraneous-dependencies
import {
    DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
// eslint-disable-next-line import/no-extraneous-dependencies
import { fromIni } from "@aws-sdk/credential-providers";

import MetaStorage from "../meta-storage";
import { File, isExpired } from "../utils/file";
import type { S3MetaStorageOptions } from "./types";

class S3MetaStorage<T extends File = File> extends MetaStorage<T> {
    private readonly bucket: string;

    private readonly client: S3Client;

    constructor(public config: S3MetaStorageOptions) {
        super(config);

        const bucket = config.bucket || process.env.S3_BUCKET;

        if (!bucket) {
            throw new Error("S3 bucket is not defined");
        }

        this.bucket = bucket;
        // eslint-disable-next-line no-param-reassign
        const keyFile = config.keyFile || process.env.S3_KEYFILE;

        if (keyFile) {
            // eslint-disable-next-line no-param-reassign
            config.credentials = fromIni({ configFilepath: keyFile });
        }

        this.client = new S3Client(config);
    }

    async get(id: string): Promise<T> {
        const Key = this.getMetaName(id);
        const parameters = { Bucket: this.bucket, Key };
        const { Metadata, Expires } = await this.client.send(new HeadObjectCommand(parameters));

        if (Expires && isExpired({ expiredAt: Expires } as T)) {
            await this.delete(Key);

            throw new Error(`Metafile ${id} not found`);
        }

        if (Metadata !== undefined && Metadata.metadata !== undefined) {
            return JSON.parse(decodeURIComponent(Metadata.metadata)) as T;
        }

        throw new Error(`Metafile ${id} not found`);
    }

    public async touch(id: string, file: T): Promise<T> {
        return this.save(id, file);
    }

    async delete(id: string): Promise<void> {
        const parameters = { Bucket: this.bucket, Key: this.getMetaName(id) };

        await this.client.send(new DeleteObjectCommand(parameters));
    }

    async save(id: string, file: T): Promise<T> {
        const metadata = encodeURIComponent(JSON.stringify(file));
        const parameters = {
            Bucket: this.bucket,
            Key: this.getMetaName(id),
            Metadata: { metadata },
            ContentLength: 0,
        };

        await this.client.send(new PutObjectCommand(parameters));

        return file;
    }

    // eslint-disable-next-line radar/cognitive-complexity
    public async list(limit: number = 1000): Promise<T[]> {
        let parameters: ListObjectsV2CommandInput = {
            Bucket: this.bucket,
            Prefix: this.prefix,
            MaxKeys: limit,
        };
        const items: T[] = [];

        // Declare truncated as a flag that the while loop is based on.
        let truncated = true;

        while (truncated) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const response = await this.client.send(
                    new ListObjectsV2Command(parameters),
                );

                // eslint-disable-next-line no-restricted-syntax,no-await-in-loop
                for await (const { Key, LastModified } of response.Contents as _Object[]) {
                    if (Key && LastModified && Key.endsWith(this.suffix)) {
                        const { Expires } = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.getMetaName(Key) }));

                        if (Expires && isExpired({ expiredAt: Expires } as T)) {
                            await this.delete(Key);
                        } else {
                            items.push({
                                id: this.getIdFromMetaName(Key),
                                createdAt: LastModified,
                                modifiedAt: LastModified,
                            } as T);
                        }
                    }
                }

                truncated = response.IsTruncated || false;

                if (truncated) {
                    // Declare a variable to which the key of the last element is assigned to in the response.
                    parameters = { ...parameters, ContinuationToken: response.NextContinuationToken };
                }
            } catch (error) {
                truncated = false;

                throw error;
            }
        }

        return items;
    }
}

export default S3MetaStorage;
