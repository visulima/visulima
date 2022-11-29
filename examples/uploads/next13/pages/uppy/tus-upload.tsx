import { useEffect, useMemo, useState } from "react";
import Uppy from "@uppy/core";
import Tus from "@uppy/tus";
import { Dashboard } from "@uppy/react";

import "@uppy/core/dist/style.css";
import "@uppy/dashboard/dist/style.css";

const TusUpload = () => {
    const [url, setUrl] = useState("");

    const uppy = useMemo(() => {
        const instance = new Uppy({
            meta: { type: "avatar" },
            restrictions: { maxNumberOfFiles: 1 },
            autoProceed: true,
        });
        instance.use(Tus, { endpoint: "/api/files/tus" });

        return instance;
    }, []);

    useEffect(() => {
        return () => uppy.close({ reason: "unmount" });
    }, [uppy]);

    return (
        <div>
            <Dashboard uppy={uppy} plugins={["ProgressBar"]}/>
        </div>
    );
};

export default TusUpload;
