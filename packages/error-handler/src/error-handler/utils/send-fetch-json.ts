export const sendFetchJson = (jsonBody: unknown, status: number, contentType: string = "application/json; charset=utf-8"): Response =>
    new Response(JSON.stringify(jsonBody), {
        headers: { "content-type": contentType },
        status,
    });
