import type { LocalMetaStorageOptions } from "../local/local-meta-storage";
import LocalMetaStorage from "../local/local-meta-storage";
import type SupabaseFile from "./supabase-file";

class SupabaseMetaStorage extends LocalMetaStorage<SupabaseFile> {
    public constructor(config?: LocalMetaStorageOptions) {
        super(config);
    }
}

export default SupabaseMetaStorage;
