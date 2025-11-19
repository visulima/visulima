import { File } from "../utils/file";

class NetlifyBlobFile extends File {
    /**
     * The blob's public URL
     */
    public url?: string;

    /**
     * The blob's pathname within the store
     */
    public pathname?: string;
}

export default NetlifyBlobFile;
