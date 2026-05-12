import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type BunnyFile from "./bunny-file";

class BunnyMetaStorage extends LocalMetaStorage<BunnyFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default BunnyMetaStorage;
