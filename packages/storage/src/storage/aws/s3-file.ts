import { File } from "../utils/file";
import type { Part } from "./s3-base-storage";

class S3File extends File {
    public Parts?: Part[];

    public UploadId?: string;

    public uri?: string;

    public partsUrls?: string[];

    public partSize?: number;
}

export default S3File;
