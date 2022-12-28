import { File } from "../utils/file";

class AzureFile extends File {
    requestId?: string;

    uri?: string;
}

export default AzureFile;
