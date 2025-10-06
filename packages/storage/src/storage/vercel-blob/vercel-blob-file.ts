import { File } from "../utils/file";

class VercelBlobFile extends File {
    /**
     * The blob's public URL
     */
    url?: string;

    /**
     * The blob's download URL (may be different from url for private blobs)
     */
    downloadUrl?: string;

    /**
     * The blob's pathname within the store
     */
    pathname?: string;
}

export default VercelBlobFile;
