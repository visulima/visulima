import { tmpdir } from "node:os";
import { join } from "node:path";

import { DiskStorage } from "@visulima/storage";
import storageModule from "@visulima/storage/adapter/nuxt";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: "2024-04-03",
    devtools: { enabled: true },
    modules: [storageModule],
    storage: {
        basePath: "/api/upload",
        multipart: true,
        rest: true,
        storage: new DiskStorage({
            directory: join(tmpdir(), "visulima-uploads"),
        }),
        tus: true,
    },
    typescript: {
        strict: true,
    },
});
