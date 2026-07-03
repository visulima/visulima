import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type FirebaseFile from "./firebase-file";

class FirebaseMetaStorage extends LocalMetaStorage<FirebaseFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default FirebaseMetaStorage;
