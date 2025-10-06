import MetaStorage from "../../../src/storage/meta-storage";
import BaseStorage from "../../../src/storage/storage";
import type { BaseStorageOptions } from "../../../src/storage/types";
import type { File, FileInit, FilePart, FileQuery } from "../../../src/storage/utils/file";

class TestStorage<TFile extends File = File> extends BaseStorage<TFile> {
    path = "/files";

    override isReady = true;

    meta = new MetaStorage<TFile>();

    constructor(config = {} as BaseStorageOptions<TFile> & { directory: string }) {
        super(config);
    }

    // eslint-disable-next-line class-methods-use-this
    public override async get({ id }: FileQuery): Promise<TFile> {
        return { content: Buffer.from([]), contentType: "application/json", id } as TFile;
    }

    // eslint-disable-next-line class-methods-use-this
    public create(_request: any, file: FileInit): Promise<TFile> {
        // eslint-disable-next-line compat/compat
        return Promise.resolve(file as TFile);
    }

    // eslint-disable-next-line class-methods-use-this
    public write(part: FilePart | FileQuery): Promise<TFile> {
        // eslint-disable-next-line compat/compat
        return Promise.resolve(part as TFile);
    }

    // eslint-disable-next-line class-methods-use-this
    public delete(file: FileQuery): Promise<TFile> {
        // eslint-disable-next-line compat/compat
        return Promise.resolve(file as TFile);
    }

    // eslint-disable-next-line class-methods-use-this
    protected getBinary(): Promise<Buffer> {
        throw new Error("Method not implemented.");
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public async copy(_name: string, _destination: string): Promise<any> {
        // eslint-disable-next-line compat/compat
        return undefined;
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/no-unused-vars
    public async move(_name: string, _destination: string): Promise<any> {
        // eslint-disable-next-line compat/compat
        return undefined;
    }
}

export default TestStorage;
