import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type SftpFile from "./sftp-file";

class SftpMetaStorage extends LocalMetaStorage<SftpFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default SftpMetaStorage;
