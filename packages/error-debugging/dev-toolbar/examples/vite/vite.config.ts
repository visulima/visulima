import { devToolbar } from "@visulima/dev-toolbar/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        devToolbar({
            apps: {
                settings: true,
                timeline: true,
            },
            placement: "bottom-center",
            defaultVisible: true,
        }),
    ],
});
