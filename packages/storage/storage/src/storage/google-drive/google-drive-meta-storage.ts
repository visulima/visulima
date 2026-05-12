import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type GoogleDriveFile from "./google-drive-file";

class GoogleDriveMetaStorage extends LocalMetaStorage<GoogleDriveFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default GoogleDriveMetaStorage;
