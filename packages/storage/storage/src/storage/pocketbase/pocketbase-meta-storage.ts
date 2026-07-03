import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type PocketBaseFile from "./pocketbase-file";

class PocketBaseMetaStorage extends LocalMetaStorage<PocketBaseFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default PocketBaseMetaStorage;
