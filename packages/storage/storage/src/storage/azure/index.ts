export { default as AzureFile } from "./azure-file";
export { default as AzureMetaStorage } from "./azure-meta-storage";
export {
    /** @deprecated Misspelled; use `AzureMetaStorage`. */
    default as AzureSMetaStorage,
} from "./azure-meta-storage";
export { default as AzureStorage } from "./azure-storage";
export type { AzureMetaStorageOptions, AzureStorageOptions } from "./types";
