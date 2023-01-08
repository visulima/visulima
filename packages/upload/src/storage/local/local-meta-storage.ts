import { tmpdir } from "node:os";
import { join } from "node:path";
import normalize from "normalize-path";

import { removeFile } from "../../utils";
import { fsp } from "../../utils/fs";
import MetaStorage from "../meta-storage";
import type { MetaStorageOptions } from "../types";
import { File } from "../utils/file";

/**
 * Stores upload metafiles on local disk
 */
class LocalMetaStorage<T extends File = File> extends MetaStorage<T> {
    readonly directory: string;

    constructor(config?: LocalMetaStorageOptions) {
        super(config);

        this.directory = (config?.directory || join(tmpdir(), "Upload_meta")).replace(/\\/g, "/");

        this.accessCheck().catch((error) => {
            this.logger?.error("[error]: Could not write to directory: %O", error);
        });
    }

    /**
     * Returns metafile path
     * @param id - upload id
     */
    public getMetaPath = (id: string): string => normalize(`${this.directory}/${this.prefix + id + this.suffix}`);

    /**
     * Returns upload id from metafile path
     * @internal
     */
    public getIdFromPath = (metaFilePath: string): string => metaFilePath.slice(`${this.directory}/${this.prefix}`.length, -this.suffix.length);

    public async save(id: string, file: T): Promise<T> {
        await fsp.writeFile(this.getMetaPath(id), JSON.stringify(file));

        return file;
    }

    public async touch(id: string, file: T): Promise<T> {
        const time = new Date();

        await fsp.utimes(this.getMetaPath(id), time, time);

        return file;
    }

    public async get(id: string): Promise<T> {
        const json = await fsp.readFile(this.getMetaPath(id), { encoding: "utf8" });

        if (json === undefined) {
            throw new TypeError("Invalid metafile");
        }

        return JSON.parse(json) as T;
    }

    public async delete(id: string): Promise<void> {
        await removeFile(this.getMetaPath(id));
    }

    private async accessCheck(): Promise<void> {
        await fsp.mkdir(this.directory, { recursive: true });
    }
}

export interface LocalMetaStorageOptions extends MetaStorageOptions {
    /**
     * Where the upload metadata should be stored
     */
    directory?: string;
}

export default LocalMetaStorage;
