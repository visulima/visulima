import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";

class VercelBlobMetaStorage extends LocalMetaStorage {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default VercelBlobMetaStorage;
