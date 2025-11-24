import { createFileRoute } from "@tanstack/react-router";
import type { UploadResult } from "@visulima/storage-client/react";
import { useUpload } from "@visulima/storage-client/react";
import { useRef, useState } from "react";

const Home = () => {
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { error, isUploading, progress, reset, result, upload } = useUpload({
        endpointMultipart: "/api/upload/multipart",
        endpointTus: "/api/upload/tus",
        onError: (error_: Error) => console.error("Upload error:", error_),
        onProgress: (p: number) => console.log("Upload progress:", p),
        onSuccess: (res: UploadResult) => {
            console.log("Upload successful:", res);
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

    const handleReset = () => {
        reset();
        setFile(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div style={{ margin: "0 auto", "max-width": "800px", padding: "2rem" }}>
            <h1>File Upload Example</h1>
            <p>Upload files using @visulima/storage-client with TanStack Start</p>

            <div style={{ "margin-top": "2rem" }}>
                <input disabled={isUploading} onChange={handleFileChange} ref={fileInputRef} type="file" />
                <button disabled={!file || isUploading} onClick={handleUpload} style={{ "margin-left": "1rem", padding: "0.5rem 1rem" }}>
                    {isUploading ? `Uploading... ${progress}%` : "Upload"}
                </button>
                <button disabled={isUploading} onClick={handleReset} style={{ "margin-left": "0.5rem", padding: "0.5rem 1rem" }}>
                    Reset
                </button>
            </div>

            {isUploading && (
                <div style={{ "margin-top": "1rem" }}>
                    <div>
                        Progress:
                        {progress}
                        %
                    </div>
                    <progress max={100} style={{ "max-width": "400px", width: "100%" }} value={progress} />
                </div>
            )}

            {error && (
                <div style={{ "background-color": "#fee", "border-radius": "4px", color: "#c33", "margin-top": "1rem", padding: "1rem" }}>
                    Error:
                    {error.message}
                </div>
            )}

            {result && (
                <div style={{ "background-color": "#efe", "border-radius": "4px", color: "#3c3", "margin-top": "1rem", padding: "1rem" }}>
                    <div>Upload complete!</div>
                    <div>
                        File ID:
                        {result.id}
                    </div>
                    {result.filename && (
                        <div>
                            Filename:
                            {result.filename}
                        </div>
                    )}
                    {result.url && (
                        <div>
                            URL:
                            {" "}
                            <a href={result.url} rel="noopener noreferrer" target="_blank">
                                {result.url}
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const Route = createFileRoute("/")({
    component: Home,
});
