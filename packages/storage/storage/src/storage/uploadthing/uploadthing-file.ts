import { File } from "../utils/file";

class UploadThingFile extends File {
    public customId?: string;

    public fileHash?: string;

    public ufsKey?: string;

    public url?: string;
}

export default UploadThingFile;
