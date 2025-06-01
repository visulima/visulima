import { createServer } from "node:http";

import httpDisplayer from "../dist/displayer/http-displayer.mjs";

const port = 3000;
const server = createServer(async (request, response) => {
    // const originalWrite = response.write;

    // response.write = function (chunk, encoding, callback) {
    //     const html = chunk;
    //     // Hack to have a live reload
    //     // refresh the page every 5 seconds
    //     // html = html.replace("</head>", "<script>setTimeout(function(){\nwindow.location.reload(1);\n}, 5000);</script></head>");
    //
    //     return originalWrite.call(this, html, encoding, callback);
    // };

    const error = new Error("This is a error message", {
        cause: new Error("This is a cause message", {
            cause: new Error("This is a nested cause message", {
                cause: ["This is a nested cause string message", new Error("This is a nested cause message")],
            }),
        }),
    });

    error.hint = "This is a hint message";

    try {
        const displayerHandler = await httpDisplayer(error, [
            // openAiFinder()
        ]);

        // Assuming displayerHandler is a function that might be async or return a promise
        await displayerHandler(request, response);
    } catch (error_) {
        console.error("Error in flame's httpDisplayer or its handler:", error_);

        // Attempt to send a fallback response
        if (!response.headersSent) {
            response.writeHead(500, { "Content-Type": "text/plain" });
            response.end("Internal Server Error: Could not display error details.");
        } else if (!response.writableEnded) {
            // If headers sent but response not ended, try to end it.
            response.end();
        }
        // If response.writableEnded is true, it's already finished.
    }
});

server.listen(port, () => {
    console.log(`Running at http://localhost:${port}`);
});
