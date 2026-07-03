import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type SharePointFile from "./sharepoint-file";

class SharePointMetaStorage extends LocalMetaStorage<SharePointFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default SharePointMetaStorage;
