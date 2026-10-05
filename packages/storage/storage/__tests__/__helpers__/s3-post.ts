import { createHmac } from "node:crypto";

const hmac = (key: Buffer | string, data: string): Buffer => createHmac("sha256", key).update(data).digest();

/** An S3 error answer to a form POST: the status and `&lt;Code>` S3 would send. */
export class S3PostError extends Error {
    public constructor(
        public readonly status: number,
        public readonly code: string,
    ) {
        super(code);
    }
}

/**
 * Checks a browser-form POST upload the way S3 does before storing it: the SigV4 signature over
 * the policy, its expiry, that every form field is covered by a condition, and the
 * `content-length-range`. Returns the object to store, or throws an {@link S3PostError}.
 */
export const acceptS3Post = (
    fields: Record<string, string>,
    body: Buffer,
    { bucket, now = new Date(), secretAccessKey }: { bucket: string; now?: Date; secretAccessKey: string },
): { body: Buffer; contentType?: string; key: string } => {
    const { Policy: policy, "X-Amz-Signature": signature, ...signed } = fields;
    const [, day = "", region = "", service = ""] = (signed["x-amz-credential"] ?? "").split("/");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), service), "aws4_request");

    if (policy === undefined || hmac(signingKey, policy).toString("hex") !== signature) {
        throw new S3PostError(403, "SignatureDoesNotMatch");
    }

    const { conditions, expiration } = JSON.parse(Buffer.from(policy, "base64").toString()) as { conditions: unknown[]; expiration: string };

    if (new Date(expiration) < now) {
        throw new S3PostError(403, "AccessDenied");
    }

    const covered = new Set<string>();

    for (const condition of conditions) {
        if (Array.isArray(condition)) {
            const [name, min, max] = condition as [string, number, number];

            if (name !== "content-length-range") {
                throw new S3PostError(400, "InvalidPolicyDocument");
            }

            if (body.byteLength < min) {
                throw new S3PostError(400, "EntityTooSmall");
            }

            if (body.byteLength > max) {
                throw new S3PostError(400, "EntityTooLarge");
            }

            continue;
        }

        const [[name, value]] = Object.entries(condition as Record<string, string>) as [[string, string]];

        if (name === "bucket" ? value !== bucket : signed[name] !== value) {
            throw new S3PostError(403, "AccessDenied");
        }

        covered.add(name);
    }

    if (Object.keys(signed).some((name) => !covered.has(name))) {
        throw new S3PostError(403, "AccessDenied");
    }

    return { body, contentType: signed["Content-Type"], key: signed.key as string };
};
