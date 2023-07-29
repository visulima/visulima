// eslint-disable-next-line unicorn/prevent-abbreviations
import { env as process_environment } from "process";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isProduction = process_environment.NODE_ENV === "production";

let validation = z.string().optional();

if (isProduction) {
    validation = z.string().min(1).optional();
}

const environment = createEnv({
    client: {
        NEXT_PUBLIC_COMMENTS_CATEGORY_ID: validation,
        NEXT_PUBLIC_COMMENTS_REPO: validation,
        NEXT_PUBLIC_COMMENTS_REPO_ID: validation,
        NEXT_PUBLIC_FATHOM_ID: validation,
    },
    /**
     * What object holds the environment variables at runtime.
     * Often `process.env` or `import.meta.env`
     */
    runtimeEnv: {
        NEXT_PUBLIC_COMMENTS_CATEGORY_ID: process_environment.NEXT_PUBLIC_COMMENTS_CATEGORY_ID,
        NEXT_PUBLIC_COMMENTS_REPO: process_environment.NEXT_PUBLIC_COMMENTS_REPO,
        NEXT_PUBLIC_COMMENTS_REPO_ID: process_environment.NEXT_PUBLIC_COMMENTS_REPO_ID,
        NEXT_PUBLIC_FATHOM_ID: process_environment.NEXT_PUBLIC_FATHOM_ID,
    },
});

export default environment;
