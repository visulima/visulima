import { File } from "../utils/file";

class SupabaseFile extends File {
    public bucket?: string;

    public path?: string;

    public publicUrl?: string;
}

export default SupabaseFile;
