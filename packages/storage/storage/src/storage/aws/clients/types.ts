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

export type CreateHetznerClientParameters = {
    /**
     * Hetzner Object Storage access key ID.
     */
    accessKeyId: string;

    /**
     * Hetzner Object Storage location. Used as both the region and the
     * subdomain of the endpoint (`https://{location}.your-objectstorage.com`).
     */
    location: "fsn1" | "hel1" | "nbg1";

    /**
     * Hetzner Object Storage secret access key.
     */
    secretAccessKey: string;
};

export type CreateAkamaiClientParameters = {
    /**
     * Akamai Cloud Object Storage access key ID.
     */
    accessKeyId: string;

    /**
     * Override the endpoint. When unset, defaults to
     * `https://${region}.linodeobjects.com`. The `linodeobjects.com` domain
     * is unchanged from the Linode era — only the product branding moved
     * to Akamai.
     */
    endpoint?: string;

    /**
     * Akamai Cloud Object Storage region/cluster code (formerly Linode Object
     * Storage). Examples: `"us-iad-1"`, `"us-mia-1"`, `"us-ord-1"`,
     * `"nl-ams-1"`, `"fr-par-1"`, `"gb-lon-1"`, `"jp-osa-1"`, plus the older
     * `"us-east-1"` / `"eu-central-1"` / `"ap-south-1"` clusters.
     */
    region: string;

    /**
     * Akamai Cloud Object Storage secret access key.
     */
    secretAccessKey: string;
};

export type CreateStorjClientParameters = {
    /**
     * Storj S3 Gateway access key (derived from a Storj access grant).
     */
    accessKeyId: string;

    /**
     * Override the Storj S3 Gateway endpoint.
     * @default `https://gateway.storjshare.io`
     */
    endpoint?: string;

    /**
     * Storj S3 Gateway secret key (derived from a Storj access grant).
     */
    secretAccessKey: string;
};
