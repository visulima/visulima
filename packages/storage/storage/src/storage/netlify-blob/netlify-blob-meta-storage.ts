import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type NetlifyBlobFile from "./netlify-blob-file";

class NetlifyBlobMetaStorage extends LocalMetaStorage<NetlifyBlobFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default NetlifyBlobMetaStorage;
