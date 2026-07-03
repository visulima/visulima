import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type OneDriveFile from "./onedrive-file";

class OneDriveMetaStorage extends LocalMetaStorage<OneDriveFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default OneDriveMetaStorage;
