"use client";

import { useUpload } from "@visulima/storage-client/react";
import { useRef, useState } from "react";

export default function Home() {
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { error, isUploading, progress, result, upload } = useUpload({
        endpointMultipart: "/api/upload/multipart",
        endpointTus: "/api/upload/tus",
        onError: (error) => {
            console.error("Upload error:", error);
        },
        onSuccess: (result) => {
            console.log("Upload successful:", result);
            setFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
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
        <main>
            <h1>Storage Client - Next.js Example</h1>
            <div style={{ marginTop: "2rem" }}>
                <input disabled={isUploading} onChange={handleFileChange} ref={fileInputRef} type="file" />
                <button disabled={!file || isUploading} onClick={handleUpload} style={{ marginLeft: "1rem" }}>
                    {isUploading ? "Uploading..." : "Upload"}
                </button>
            </div>
            {isUploading && (
                <div style={{ marginTop: "1rem" }}>
                    <div>
                        Progress:
                        {progress}
                        %
                    </div>
                    <progress max={100} value={progress} />
                </div>
            )}
            {error && (
                <div style={{ color: "red", marginTop: "1rem" }}>
                    Error:
                    {error.message}
                </div>
            )}
            {result && (
                <div style={{ color: "green", marginTop: "1rem" }}>
                    Upload complete! File:
                    {result.filename}
                </div>
            )}
        </main>
    );
}
