import * as Fathom from "fathom-client";
import { useRouter } from "next/router";
import { useEffect } from "react";
import env from "../env/env-client";

const useFathom = () => {
    const router = useRouter();

    useEffect(() => {
        if (process.env.NODE_ENV === "production" && env["NEXT_PUBLIC_FATHOM_ID"]) {
            Fathom.load(env["NEXT_PUBLIC_FATHOM_ID"], {
                url: "https://cdn-eu.usefathom.com/script.js",
                includedDomains: ["visulima.com"],
            });
        }

        const onRouteChangeComplete = () => {
            Fathom.trackPageview();
        }

        router.events.on("routeChangeComplete", onRouteChangeComplete);

        return () => {
            router.events.off("routeChangeComplete", onRouteChangeComplete);
        };
    }, [router.events]);
};

export default useFathom;
