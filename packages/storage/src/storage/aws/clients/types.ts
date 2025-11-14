export type CreateCloudflareClientParameters = {
    /**
     * Cloudflare R2 access key ID.
     */
    accessKeyId: string;

    /**
     * Cloudflare account ID.
     */
    accountId: string;

    /**
     * The jurisdiction where the data is stored.
     *
     * Only use this if you created your R2 bucket using a jurisdiction.
     */
    jurisdiction?: "eu" | "fedramp";

    /**
     * Cloudflare R2 secret access key.
     */
    secretAccessKey: string;
};

export type CreateMinioClientParameters = {
    /**
     * Minio access key ID.
     */
    accessKeyId: string;

    /**
     * Minio endpoint.
     */
    endpoint: string;

    /**
     * Minio region.
     */
    region: string;

    /**
     * Minio secret access key.
     */
    secretAccessKey: string;
};

export type CreateBackblazeClientParameters = {
    /**
     * Backblaze B2 application key.
     */
    applicationKey: string;

    /**
     * Backblaze B2 application key ID.
     */
    applicationKeyId: string;

    /**
     * Backblaze B2 region.
     */
    region: string;
};

export type CreateWasabiClientParameters = {
    /**
     * Wasabi access key ID.
     */
    accessKeyId: string;

    /**
     * Wasabi region.
     */
    region: string;

    /**
     * Wasabi secret access key.
     */
    secretAccessKey: string;
};

export type CreateDigitalOceanClientParameters = {
    /**
     * DigitalOcean Spaces key.
     */
    key: string;

    /**
     * DigitalOcean Spaces region.
     */
    region: string;

    /**
     * DigitalOcean Spaces secret.
     */
    secret: string;
};

export type CreateTigrisClientParameters = {
    /**
     * Tigris access key ID.
     */
    accessKeyId: string;

    /**
     * Tigris endpoint.
     * @default `https://t3.storage.dev`
     */
    endpoint?: string;

    /**
     * Tigris secret access key.
     */
    secretAccessKey: string;
};
