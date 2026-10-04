import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type WebdavFile from "./webdav-file";

class WebdavMetaStorage extends LocalMetaStorage<WebdavFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default WebdavMetaStorage;
