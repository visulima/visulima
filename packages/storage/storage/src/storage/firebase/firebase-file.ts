import { File } from "../utils/file";

class FirebaseFile extends File {
    public bucket?: string;

    public path?: string;

    public publicUrl?: string;
}

export default FirebaseFile;
