import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type BoxFile from "./box-file";

class BoxMetaStorage extends LocalMetaStorage<BoxFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default BoxMetaStorage;
