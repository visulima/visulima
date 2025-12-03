import { File } from "../utils/file";

class VercelBlobFile extends File {
    /**
     * The blob's public URL
     */
    public url?: string;

    /**
     * The blob's download URL (may be different from url for private blobs)
     */
    public downloadUrl?: string;

    /**
     * The blob's pathname within the store
     */
    public pathname?: string;
}

export default VercelBlobFile;
