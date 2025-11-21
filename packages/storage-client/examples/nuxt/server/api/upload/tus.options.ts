export default defineEventHandler(() => {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Headers": "Content-Type, Upload-Offset, Upload-Length, Tus-Resumable",
            "Access-Control-Allow-Methods": "POST, PATCH, HEAD, OPTIONS",
            "Access-Control-Allow-Origin": "*",
        },
        status: 204,
    });
});

