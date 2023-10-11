import { load, trackPageview } from "fathom-client";
import type { NextRouter } from "next/router";
import { useRouter } from "next/router";
import { useEffect } from "react";

import environment from "../env/env-client";

const useFathom = (): void => {
    const router: NextRouter = useRouter();

    useEffect(() => {
        if (process.env.NODE_ENV === "production" && environment.NEXT_PUBLIC_FATHOM_ID) {
            load(environment.NEXT_PUBLIC_FATHOM_ID, {
                includedDomains: ["visulima.com"],
                url: "https://cdn-eu.usefathom.com/script.js",
            });
        }

        const onRouteChangeComplete = () => {
            trackPageview();
        };

        router.events.on("routeChangeComplete", onRouteChangeComplete);

        return () => {
            router.events.off("routeChangeComplete", onRouteChangeComplete);
        };
    }, [router.events]);
};

export default useFathom;
