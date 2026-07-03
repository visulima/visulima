import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type UploadThingFile from "./uploadthing-file";

class UploadThingMetaStorage extends LocalMetaStorage<UploadThingFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default UploadThingMetaStorage;
