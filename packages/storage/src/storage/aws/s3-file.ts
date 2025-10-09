import type { Part } from "@aws-sdk/client-s3";

import { File } from "../utils/file";

class S3File extends File {
    public Parts?: Part[];

    public UploadId?: string;

    public uri?: string;

    public partsUrls?: string[];

    public partSize?: number;
}

export default S3File;
