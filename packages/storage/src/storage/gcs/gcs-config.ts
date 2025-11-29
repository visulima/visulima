const GCSConfig: Record<string, string | string[]> = {
    authScopes: [
        "https://www.googleapis.com/auth/iam",
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/devstorage.full_control",
    ],
    storageAPI: "https://storage.googleapis.com/storage/v1/b",
    uploadAPI: "https://storage.googleapis.com/upload/storage/v1/b",
};

export default GCSConfig;
