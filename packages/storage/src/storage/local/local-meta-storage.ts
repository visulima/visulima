import { utimes } from "node:fs/promises";
import { tmpdir } from "node:os";

// eslint-disable-next-line import/no-extraneous-dependencies
import { ensureDir, readFile, remove, writeFile } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { join, normalize } from "@visulima/path";

import { ERRORS, throwErrorCode } from "../../utils/errors";
import MetaStorage from "../meta-storage";
import type { MetaStorageOptions } from "../types";
import type { File } from "../utils/file";
import { parseMetadata, stringifyMetadata } from "../utils/file/metadata";

/**
 * Stores upload metafiles on local disk
 */
class LocalMetaStorage<T extends File = File> extends MetaStorage<T> {
    public readonly directory: string;

    public constructor(config?: LocalMetaStorageOptions) {
        super(config);

        this.directory = normalize(config?.directory || join(tmpdir(), "Upload_meta"));

        this.accessCheck().catch((error) => {
            this.logger?.error("Metadata storage access check failed: %O", error);
        });
    }

    /**
     * Returns metafile path.
     * @param id upload id
     */
    public getMetaPath = (id: string): string => normalize(`${this.directory}/${this.prefix}${id}${this.suffix}`);

    /**
     * Returns upload id from metafile path.
     * @internal
     */
    public getIdFromPath = (metaFilePath: string): string => metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);

    public override async save(id: string, file: T): Promise<T> {
        await this.accessCheck();

        const transformedMetadata = { ...file } as unknown as Omit<T, "metadata"> & { metadata?: string };

        if (transformedMetadata.metadata) {
            transformedMetadata.metadata = stringifyMetadata(file.metadata);
        }

        await writeFile(this.getMetaPath(id), JSON.stringify(transformedMetadata), {
            recursive: true,
        });

        return file;
    }

    public override async touch(id: string, file: T): Promise<T> {
        const time = new Date();

        await utimes(this.getMetaPath(id), time, time);

        return file;
    }

    public override async get(id: string): Promise<T> {
        try {
            const json = await readFile(this.getMetaPath(id));

            if (json === undefined) {
                throw new TypeError("Invalid metafile");
            }

            const file = JSON.parse(json) as T;

            if (file.metadata && typeof file.metadata === "string") {
                file.metadata = parseMetadata(file.metadata);
            }

            return file;
        } catch (error) {
            if (error instanceof Error && error.message.includes("ENOENT")) {
                throw throwErrorCode(ERRORS.FILE_NOT_FOUND);
            }

            throw error;
        }
    }

    public override async delete(id: string): Promise<void> {
        await remove(this.getMetaPath(id));
    }

    private async accessCheck(): Promise<void> {
        await ensureDir(this.directory);
    }
}

export interface LocalMetaStorageOptions extends MetaStorageOptions {
    /**
     * Where the upload metadata should be stored
     */
    directory?: string;
}

export default LocalMetaStorage;
