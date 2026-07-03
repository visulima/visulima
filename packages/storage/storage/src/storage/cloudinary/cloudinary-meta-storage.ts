import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type CloudinaryFile from "./cloudinary-file";

class CloudinaryMetaStorage extends LocalMetaStorage<CloudinaryFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default CloudinaryMetaStorage;
