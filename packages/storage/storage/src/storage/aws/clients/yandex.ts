import type { S3ClientConfig } from "@aws-sdk/client-s3";

import type { CreateYandexClientParameters } from "./types";

/**
 * Create a Yandex Object Storage client, compatible with the S3 API.
 *
 * Yandex serves a single global endpoint (`https://storage.yandexcloud.net`)
 * and routes internally, so the region is only the SigV4 signing scope and
 * defaults to `ru-central1`. It does not drive the endpoint, so falling back
 * to `AWS_REGION` is safe here.
 *
 * Optionally, you can omit the parameters and use the following environment variables:
 * - `AWS_ACCESS_KEY_ID` / `YANDEX_ACCESS_KEY_ID`
 * - `AWS_SECRET_ACCESS_KEY` / `YANDEX_SECRET_ACCESS_KEY`
 * - `AWS_REGION` / `YANDEX_REGION` (defaults to `ru-central1`)
 * - `YANDEX_ENDPOINT`
 */
const yandex = (parameters?: CreateYandexClientParameters): S3ClientConfig => {
    const accessKeyId = parameters?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? process.env.YANDEX_ACCESS_KEY_ID;
    const endpoint = parameters?.endpoint ?? process.env.YANDEX_ENDPOINT;
    const region = parameters?.region ?? process.env.AWS_REGION ?? process.env.YANDEX_REGION ?? "ru-central1";
    const secretAccessKey = parameters?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? process.env.YANDEX_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing required parameters for Yandex Object Storage client.");
    }

    return {
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: endpoint ?? "https://storage.yandexcloud.net",
        forcePathStyle: false,
        region,
    };
};

export default yandex;
