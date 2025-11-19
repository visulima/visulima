import type { Part } from "../aws/s3-base-storage";
import { File } from "../utils/file";

class AwsLightFile extends File {
    public Parts?: Part[];

    public UploadId?: string;

    public uri?: string;

    public partsUrls?: string[];

    public partSize?: number;
}

export default AwsLightFile;
