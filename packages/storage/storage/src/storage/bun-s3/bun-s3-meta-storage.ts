import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type BunS3File from "./bun-s3-file";

class BunS3MetaStorage extends LocalMetaStorage<BunS3File> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default BunS3MetaStorage;
