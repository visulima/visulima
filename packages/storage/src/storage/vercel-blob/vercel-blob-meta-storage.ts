import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type VercelBlobFile from "./vercel-blob-file";

class VercelBlobMetaStorage extends LocalMetaStorage<VercelBlobFile> {
    constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default VercelBlobMetaStorage;
