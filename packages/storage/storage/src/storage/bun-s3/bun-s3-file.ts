import { File } from "../utils/file";

class BunS3File extends File {
    /**
     * ETag reported by the S3-compatible backend (when present on the
     * stored object).
     */
    public bunS3ETag?: string;

    /**
     * Object key within the bucket.
     */
    public bunS3Key?: string;
}

export default BunS3File;
