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

export type CreateScalewayClientParameters = {
    /**
     * Scaleway Object Storage access key ID.
     */
    accessKeyId: string;

    /**
     * Override the endpoint. When unset, defaults to
     * `https://s3.${region}.scw.cloud`.
     */
    endpoint?: string;

    /**
     * Scaleway region. Used as both the S3 region and the endpoint subdomain.
     */
    region: "fr-par" | "nl-ams" | "pl-waw";

    /**
     * Scaleway Object Storage secret access key.
     */
    secretAccessKey: string;
};

export type CreateVultrClientParameters = {
    /**
     * Vultr Object Storage access key.
     */
    accessKeyId: string;

    /**
     * Vultr Object Storage cluster/location code. Used as both the S3 region
     * and the endpoint subdomain (`https://{location}.vultrobjects.com`).
     * Examples: `"ewr1"`, `"sjc1"`, `"ams1"`, `"sgp1"`, `"del1"`, `"blr1"`.
     */
    location: string;

    /**
     * Vultr Object Storage secret key.
     */
    secretAccessKey: string;
};

export type CreateExoscaleClientParameters = {
    /**
     * Exoscale SOS API key.
     */
    accessKeyId: string;

    /**
     * Exoscale SOS API secret.
     */
    secretAccessKey: string;

    /**
     * Exoscale zone. Used as both the S3 region and the endpoint subdomain
     * (`https://sos-{zone}.exo.io`). Examples: `"ch-gva-2"`, `"ch-dk-2"`,
     * `"de-fra-1"`, `"de-muc-1"`, `"at-vie-1"`, `"at-vie-2"`, `"bg-sof-1"`.
     */
    zone: string;
};

export type CreateFilebaseClientParameters = {
    /**
     * Filebase access key.
     */
    accessKeyId: string;

    /**
     * Override the Filebase endpoint.
     * @default `https://s3.filebase.com`
     */
    endpoint?: string;

    /**
     * Filebase secret key.
     */
    secretAccessKey: string;
};

export type CreateIDriveE2ClientParameters = {
    /**
     * iDrive e2 access key ID.
     */
    accessKeyId: string;

    /**
     * iDrive e2 endpoint. Account/region specific (assigned by iDrive), e.g.
     * `https://x9y8.va.idrivee2-12.com` — there is no deterministic default,
     * so the endpoint must be supplied.
     */
    endpoint: string;

    /**
     * iDrive e2 region.
     * @default `us-east-1`
     */
    region?: string;

    /**
     * iDrive e2 secret access key.
     */
    secretAccessKey: string;
};

export type CreateIbmCosClientParameters = {
    /**
     * IBM Cloud Object Storage HMAC access key ID.
     */
    accessKeyId: string;

    /**
     * Override the endpoint. When unset, defaults to
     * `https://s3.${region}.cloud-object-storage.appdomain.cloud`.
     */
    endpoint?: string;

    /**
     * IBM COS region. Used as both the S3 region and the endpoint subdomain.
     * Examples: `"us-south"`, `"us-east"`, `"eu-gb"`, `"eu-de"`, `"jp-tok"`,
     * `"au-syd"`, `"ca-tor"`, `"br-sao"`.
     */
    region: string;

    /**
     * IBM Cloud Object Storage HMAC secret access key.
     */
    secretAccessKey: string;
};

export type CreateOracleCloudClientParameters = {
    /**
     * OCI Object Storage Customer Secret Key access key ID.
     */
    accessKeyId: string;

    /**
     * Object Storage namespace (tenancy-specific). Forms part of the endpoint
     * host: `https://{namespace}.compat.objectstorage.{region}.oraclecloud.com`.
     */
    namespace: string;

    /**
     * OCI region. Examples: `"us-ashburn-1"`, `"us-phoenix-1"`,
     * `"eu-frankfurt-1"`, `"uk-london-1"`, `"ap-tokyo-1"`.
     */
    region: string;

    /**
     * OCI Object Storage Customer Secret Key.
     */
    secretAccessKey: string;
};

export type CreateOvhCloudClientParameters = {
    /**
     * OVHcloud Object Storage access key.
     */
    accessKeyId: string;

    /**
     * Override the endpoint. When unset, defaults to the High Performance
     * (S3) endpoint `https://s3.${region}.io.cloud.ovh.net`. For the
     * Standard (Swift) offering pass `https://s3.${region}.cloud.ovh.net`.
     */
    endpoint?: string;

    /**
     * OVHcloud region. Used as both the S3 region and the endpoint subdomain.
     * Examples: `"gra"`, `"sbg"`, `"de"`, `"uk"`, `"waw"`, `"bhs"`, `"rbx"`.
     */
    region: string;

    /**
     * OVHcloud Object Storage secret key.
     */
    secretAccessKey: string;
};

export type CreateAlibabaClientParameters = {
    /**
     * Alibaba Cloud OSS access key ID.
     */
    accessKeyId: string;

    /**
     * Override the endpoint. When unset, defaults to
     * `https://oss-${region}.aliyuncs.com`.
     */
    endpoint?: string;

    /**
     * Alibaba Cloud OSS region. Used as both the S3 region and the endpoint
     * subdomain. Examples: `"cn-hangzhou"`, `"cn-shanghai"`, `"cn-beijing"`,
     * `"ap-southeast-1"`, `"us-east-1"`, `"eu-central-1"`.
     */
    region: string;

    /**
     * Alibaba Cloud OSS access key secret.
     */
    secretAccessKey: string;
};

export type CreateTencentClientParameters = {
    /**
     * Tencent COS secret ID.
     */
    accessKeyId: string;

    /**
     * Override the endpoint. When unset, defaults to
     * `https://cos.${region}.myqcloud.com`.
     */
    endpoint?: string;

    /**
     * Tencent COS region. Used as both the S3 region and the endpoint
     * subdomain. Examples: `"ap-guangzhou"`, `"ap-shanghai"`, `"ap-beijing"`,
     * `"ap-singapore"`, `"na-siliconvalley"`, `"eu-frankfurt"`.
     */
    region: string;

    /**
     * Tencent COS secret key.
     */
    secretAccessKey: string;
};

export type CreateYandexClientParameters = {
    /**
     * Yandex Object Storage access key ID.
     */
    accessKeyId: string;

    /**
     * Override the Yandex Object Storage endpoint.
     * @default `https://storage.yandexcloud.net`
     */
    endpoint?: string;

    /**
     * SigV4 signing region. Yandex serves a single global endpoint, so this
     * does not drive routing.
     * @default `ru-central1`
     */
    region?: string;

    /**
     * Yandex Object Storage secret access key.
     */
    secretAccessKey: string;
};
