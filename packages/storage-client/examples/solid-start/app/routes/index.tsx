import { createUpload } from "@visulima/storage-client/solid";
import { createSignal } from "solid-js";

export default function Home() {
    const [file, setFile] = createSignal<File | null>(null);
    const { error, isUploading, progress, result, upload } = createUpload({
        endpointMultipart: "/api/upload/multipart",
        endpointTus: "/api/upload/tus",
        onError: (error_) => {
            console.error("Upload error:", error_);
        },
        onSuccess: (result) => {
            console.log("Upload successful:", result);
        },
    });

    const handleFileChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const selectedFile = target.files?.[0];

        setFile(selectedFile || null);
    };

    const handleUpload = async () => {
        const currentFile = file();

        if (currentFile) {
            try {
                await upload(currentFile);
            } catch (error_) {
                console.error("Upload failed:", error_);
            }
        }
    };

    return (
        <main>
            <h1>Storage Client - Solid Start Example</h1>
            <div style={{ "margin-top": "2rem" }}>
                <input disabled={isUploading()} onChange={handleFileChange} type="file" />
                <button disabled={!file() || isUploading()} onClick={handleUpload} style={{ "margin-left": "1rem" }}>
                    {isUploading() ? "Uploading..." : "Upload"}
                </button>
            </div>
            {isUploading() && (
                <div style={{ "margin-top": "1rem" }}>
                    <div>
                        Progress:
                        {progress()}
                        %
                    </div>
                    <progress max={100} value={progress()} />
                </div>
            )}
            {error() && (
                <div style={{ color: "red", "margin-top": "1rem" }}>
                    Error:
                    {error()?.message}
                </div>
            )}
            {result() && (
                <div style={{ color: "green", "margin-top": "1rem" }}>
                    Upload complete! File:
                    {result()?.filename}
                </div>
            )}
        </main>
    );
}
