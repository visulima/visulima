export const sendFetchJson = (jsonBody: unknown, status: number, contentType: string = "application/json; charset=utf-8"): Response => {
    return new Response(JSON.stringify(jsonBody), {
        status,
        headers: { "content-type": contentType },
    });
};
