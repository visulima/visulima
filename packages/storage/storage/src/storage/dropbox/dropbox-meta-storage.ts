import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type DropboxFile from "./dropbox-file";

class DropboxMetaStorage extends LocalMetaStorage<DropboxFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default DropboxMetaStorage;
