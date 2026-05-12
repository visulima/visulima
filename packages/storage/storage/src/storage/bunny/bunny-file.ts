import { File } from "../utils/file";

class BunnyFile extends File {
    /**
     * SHA-256 checksum reported by Bunny Storage (when present on the
     * stored object).
     */
    public bunnyChecksum?: string;

    /**
     * Server-side path within the Storage Zone (always prefixed with `/`).
     */
    public bunnyPath?: string;
}

export default BunnyFile;
