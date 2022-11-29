import { useEffect, useMemo } from "react";
import Uppy from "@uppy/core";
import { Dashboard } from "@uppy/react";
import XHRUpload from "@uppy/xhr-upload";

import "@uppy/core/dist/style.css";
import "@uppy/dashboard/dist/style.css";

const Upload = () => {
    const uppy = useMemo(() => {
        const instance = new Uppy({
            meta: { type: "avatar" },
            restrictions: { maxNumberOfFiles: 1 },
            autoProceed: true,
        });

        instance.use(XHRUpload, {
            endpoint: "http://localhost:3000/api/files/multipart",
        });

        return instance;
    }, []);

    useEffect(() => {
        return () => uppy.close({ reason: "unmount" });
    }, [uppy]);

    return (
        <div>
            <Dashboard uppy={uppy} plugins={["ProgressBar"]} />
        </div>
    );
};

export default Upload;
