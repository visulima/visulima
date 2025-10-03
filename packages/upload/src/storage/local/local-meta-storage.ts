import { tmpdir } from "node:os";
import { mkdir, readFile, utimes, writeFile } from "node:fs/promises";

import { join, normalize } from "@visulima/path";
import { remove } from "@visulima/fs";
import MetaStorage from "../meta-storage";
import type { MetaStorageOptions } from "../types";
import type { File } from "../utils/file";

/**
 * Stores upload metafiles on local disk
 */
class LocalMetaStorage<T extends File = File> extends MetaStorage<T> {
    readonly directory: string;

    constructor(config?: LocalMetaStorageOptions) {
        super(config);

        this.directory = (config?.directory || join(tmpdir(), "Upload_meta")).replaceAll("\\", "/");

        this.accessCheck().catch((error) => {
            this.logger?.error("[error]: Could not write to directory: %O", error);
        });
    }

    /**
     * Returns metafile path
     * @param id upload id
     */
    public getMetaPath = (id: string): string => normalize(`${this.directory}/${this.prefix + id + this.suffix}`);

    /**
     * Returns upload id from metafile path
     * @internal
     */
    public getIdFromPath = (metaFilePath: string): string => metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);

    public override async save(id: string, file: T): Promise<T> {
        await writeFile(this.getMetaPath(id), JSON.stringify(file));

        return file;
    }

    public override async touch(id: string, file: T): Promise<T> {
        const time = new Date();

        await utimes(this.getMetaPath(id), time, time);

        return file;
    }

    public override async get(id: string): Promise<T> {
        const json = await readFile(this.getMetaPath(id), { encoding: "utf8" });

        if (json === undefined) {
            throw new TypeError("Invalid metafile");
        }

        return JSON.parse(json) as T;
    }

    public override async delete(id: string): Promise<void> {
        await remove(this.getMetaPath(id));
    }

    private async accessCheck(): Promise<void> {
        await mkdir(this.directory, { recursive: true });
    }
}

export interface LocalMetaStorageOptions extends MetaStorageOptions {
    /**
     * Where the upload metadata should be stored
     */
    directory?: string;
}

export default LocalMetaStorage;
