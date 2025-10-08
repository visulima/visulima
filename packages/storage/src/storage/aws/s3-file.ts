import type { Part } from "@aws-sdk/client-s3";

import { File } from "../utils/file";

class S3File extends File {
    Parts?: Part[];

    UploadId?: string;

    uri?: string;

    partsUrls?: string[];

    partSize?: number;
}

export default S3File;
