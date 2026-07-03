import { File } from "../utils/file";

class BoxFile extends File {
    public boxFileId?: string;

    public eTag?: string;

    public publicUrl?: string;
}

export default BoxFile;
