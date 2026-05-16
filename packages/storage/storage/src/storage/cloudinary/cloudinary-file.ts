import { File } from "../utils/file";

class CloudinaryFile extends File {
    public bucket?: string;

    public path?: string;

    public publicUrl?: string;
}

export default CloudinaryFile;
