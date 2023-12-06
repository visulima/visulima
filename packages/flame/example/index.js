import { createServer } from "node:http";

import httpDisplayer from "../dist/http-displayer.js";

const port = 3000;
const server = createServer(async (request, response) => {
    const originalWrite = response.write;

    response.write = function (chunk, encoding, callback) {
        const html = chunk;
        // Hack to have a live reload
        // refresh the page every 5 seconds
        // html = html.replace("</head>", "<script>setTimeout(function(){\nwindow.location.reload(1);\n}, 5000);</script></head>");

        return originalWrite.call(this, html, encoding, callback);
    };

    const error = new Error("This is a error message", {
        cause: new Error("This is a cause message", {
            cause: new Error("This is a nested cause message", {
                cause: ["This is a nested cause string message", new Error("This is a nested cause message")]
            })
        })
    });

    //error.hint = "This is a hint message";

    (await httpDisplayer(error, [
        // openAiFinder()
    ]))(request, response);
});

server.listen(port, () => {
    console.log(`Running at http://localhost:${port}`);
});
