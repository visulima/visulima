import React, { Suspense } from "react";
import TusUploady from "@rpldy/tus-uploady";
import UploadButton from "@rpldy/upload-button";

function TusUpload() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TusUploady destination={{ url: "http://localhost:3000/api/files/tus" }} noPortal featureDetection sendDataOnCreate>
                <UploadButton />
            </TusUploady>
        </Suspense>
    );
}

export default TusUpload;
