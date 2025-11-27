import "./App.css";

import { useUpload } from "@visulima/storage-client/react";
import { useState } from "react";

const App = () => {
    const [file, setFile] = useState<File | null>(null);
    const { error, isUploading, progress, result, upload } = useUpload({
        endpointMultipart: "/api/upload/multipart",
        endpointTus: "/api/upload/tus",
        onError: (error_) => {
            console.error("Upload error:", error_);
        },
        onSuccess: (result) => {
            console.log("Upload successful:", result);
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];

        setFile(selectedFile || null);
    };

    const handleUpload = async () => {
        if (file) {
            try {
                await upload(file);
            } catch (error_) {
                console.error("Upload failed:", error_);
            }
        }
    };

    return (
        <div class="app">
            <h1>Storage Client - React Example</h1>
            <div class="upload-section">
                <input disabled={isUploading} onChange={handleFileChange} type="file" />
                <button disabled={!file || isUploading} onClick={handleUpload}>
                    {isUploading ? "Uploading..." : "Upload"}
                </button>
            </div>
            {isUploading && (
                <div class="progress-section">
                    <div>
                        Progress:
                        {progress}
                        %
                    </div>
                    <progress max={100} value={progress} />
                </div>
            )}
            {error && (
                <div class="error">
                    Error:
                    {error.message}
                </div>
            )}
            {result && (
                <div class="success">
                    Upload complete! File:
                    {result.filename}
                </div>
            )}
        </div>
    );
};

export default App;
