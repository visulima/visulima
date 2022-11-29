import { File } from "../utils/file";

class GCSFile extends File {
    GCSUploadURI?: string;

    uri?: string;
}

export default GCSFile;
