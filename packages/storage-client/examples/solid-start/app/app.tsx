import "./app.css";

import { FileRoutes } from "@solidjs/start/router";
import { Links, Meta, Scripts, Title } from "@solidjs/start";
import { Suspense } from "solid-js";
import { Router } from "@solidjs/router";

export default function App() {
    return (
        <Router root={(props) => (
            <>
                <head>
                    <meta charset="utf-8" />
                    <meta content="width=device-width, initial-scale=1" name="viewport" />
                    <Meta />
                    <Links />
                    <Title>Storage Client - Solid Start Example</Title>
                </head>
                <body>
                    <Suspense>
                        {props.children}
                    </Suspense>
                    <Scripts />
                </body>
            </>
        )}>
            <FileRoutes />
        </Router>
    );
}


