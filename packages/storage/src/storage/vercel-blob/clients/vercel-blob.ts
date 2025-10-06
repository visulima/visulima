export type CreateVercelBlobClientParameters = {
    /**
     * Vercel Blob read-write token
     */
    token: string;
};

/**
 * Create a Vercel Blob client configuration.
 *
 * Optionally, you can omit the parameters and use the following environment variable:
 * - `BLOB_READ_WRITE_TOKEN`
 */
export const vercelBlob = (parameters?: CreateVercelBlobClientParameters): { token: string } => {
    const { token } = parameters ?? {
        token: process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_TOKEN,
    };

    if (!token) {
        throw new Error("Missing required parameter: Vercel Blob token. Set BLOB_READ_WRITE_TOKEN environment variable or provide token parameter.");
    }

    return { token };
};

export default vercelBlob;
