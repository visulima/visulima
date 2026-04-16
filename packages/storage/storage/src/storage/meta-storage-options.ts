export interface MetaStorageOptions {
    logger?: Console;
    prefix?: string;
    suffix?: string;
}

export interface LocalMetaStorageOptions extends MetaStorageOptions {
    /**
     * Where the upload metadata should be stored
     */
    directory?: string;
}
