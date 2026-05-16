import { File } from "../utils/file";

class PocketBaseFile extends File {
    public bucket?: string;

    public path?: string;

    public publicUrl?: string;
}

export default PocketBaseFile;
