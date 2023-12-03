import { createServer } from "node:http";

import httpDisplayer from "../dist/http-displayer.js";

const port = 3000;
const server = createServer((request, response) => {
    const orginalWrite = response.write;

    response.write = function (chunk, encoding, callback) {
        let html = chunk;
        // Hack to have a live reload
        // refresh the page every 5 seconds
        //html = html.replace("</head>", "<script>setTimeout(function(){\nwindow.location.reload(1);\n}, 5000);</script></head>");

        return orginalWrite.call(this, html, encoding, callback);
    };

    httpDisplayer(new Error("This is a error message"), request, response);
});

server.listen(port, () => {
    console.log(`Running at http://localhost:${port}`);
});
