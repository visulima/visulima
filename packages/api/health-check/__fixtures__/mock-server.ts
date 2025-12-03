import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const handlers = [
    http.get("https://example.com", () => {
        return HttpResponse.html("<html><body><h1>Hello World!</h1></body></html>");
    }),
    http.post("https://example.com", () => {
        return HttpResponse.json({});
    }),
    http.get("https://example.com/user", () => {
        // ...and respond to them using this JSON response.
        return HttpResponse.json({
            id: "c7b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3d",
            firstName: "John",
            lastName: "Maverick",
        });
    }),
];

export const server = setupServer(...handlers);
