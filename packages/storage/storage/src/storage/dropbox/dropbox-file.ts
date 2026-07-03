import { File } from "../utils/file";

class DropboxFile extends File {
    public path?: string;

    public publicUrl?: string;

    public rev?: string;
}

export default DropboxFile;
