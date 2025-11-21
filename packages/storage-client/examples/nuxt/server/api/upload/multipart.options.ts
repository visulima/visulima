export default defineEventHandler(() => {
    return new Response(null, {
        headers: {
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Origin": "*",
        },
        status: 204,
    });
});

