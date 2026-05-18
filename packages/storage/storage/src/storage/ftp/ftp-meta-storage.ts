import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type FtpFile from "./ftp-file";

class FtpMetaStorage extends LocalMetaStorage<FtpFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default FtpMetaStorage;
