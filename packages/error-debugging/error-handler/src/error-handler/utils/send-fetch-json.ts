export const sendFetchJson = (jsonBody: unknown, status: number, contentType: string = "application/json; charset=utf-8"): Response =>
    Response.json(jsonBody, {
        headers: { "content-type": contentType },
        status,
    });
