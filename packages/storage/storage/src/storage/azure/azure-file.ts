import { File } from "../utils/file";

class AzureFile extends File {
    public requestId?: string;

    public uri?: string;
}

export default AzureFile;
