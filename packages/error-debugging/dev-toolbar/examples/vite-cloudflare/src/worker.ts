// Cloudflare Worker entry point
// Serves the static React app via the ASSETS binding
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        return env.ASSETS.fetch(request);
    },
} satisfies ExportedHandler<Env>;
