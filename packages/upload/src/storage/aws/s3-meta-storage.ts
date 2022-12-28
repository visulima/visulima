// eslint-disable-next-line import/no-extraneous-dependencies
import {
    DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from "@aws-sdk/client-s3";
// eslint-disable-next-line import/no-extraneous-dependencies
import { fromIni } from "@aws-sdk/credential-providers";

import MetaStorage from "../meta-storage";
import { File } from "../utils/file";
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
        const parameters = { Bucket: this.bucket, Key: this.getMetaName(id) };
        const { Metadata } = await this.client.send(new HeadObjectCommand(parameters));

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

    public async list(): Promise<T[]> {
        const parameters = {
            Bucket: this.bucket,
            Prefix: this.prefix,
        };
        const items: T[] = [];
        const response = await this.client.send(new ListObjectsV2Command(parameters));

        if (response.Contents?.length) {
            Object.values(response.Contents).forEach(({ Key, LastModified }) => {
                if (Key && LastModified && Key.endsWith(this.suffix)) {
                    items.push({
                        id: this.getIdFromMetaName(Key),
                        createdAt: LastModified,
                        modifiedAt: LastModified,
                    } as T);
                }
            });
        }

        return items;
    }
}

export default S3MetaStorage;
