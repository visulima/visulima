const GCSConfig = {
    uploadAPI: "https://storage.googleapis.com/upload/storage/v1/b",
    storageAPI: "https://storage.googleapis.com/storage/v1/b",
    authScopes: [
        "https://www.googleapis.com/auth/iam",
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/devstorage.full_control",
    ],
};

export default GCSConfig;
