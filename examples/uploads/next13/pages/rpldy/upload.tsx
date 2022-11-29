import React, { Suspense } from "react";
import Uploady from "@rpldy/uploady";
import UploadButton from "@rpldy/upload-button";
import UploadPreview from "@rpldy/upload-preview";

function Upload() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Uploady destination={{ url: "http://localhost:3000/api/files/multipart" }} noPortal>
                <UploadPreview />
                <UploadButton />
            </Uploady>
        </Suspense>
    );
}

export default Upload;
