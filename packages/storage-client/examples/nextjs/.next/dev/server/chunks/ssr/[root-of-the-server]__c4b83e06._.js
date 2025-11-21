module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/packages/storage-client/dist/packem_shared/createChunkedRestAdapter-tTCb4Zfg.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createChunkedRestAdapter",
    ()=>createChunkedRestAdapter
]);
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const createChunkedRestAdapter = (options)=>{
    const { chunkSize = DEFAULT_CHUNK_SIZE, endpoint, maxRetries = 3, metadata = {}, retry = true } = options;
    let uploadState = {
        aborted: false,
        paused: false,
        totalSize: 0,
        uploadedChunks: /* @__PURE__ */ new Set()
    };
    let startCallback;
    let progressCallback;
    let finishCallback;
    let errorCallback;
    const fetchWithRetry = async (url, init, retriesLeft = maxRetries)=>{
        try {
            const response = await fetch(url, init);
            if (!response.ok && retriesLeft > 0 && retry) {
                const delay = 1e3 * 2 ** (maxRetries - retriesLeft);
                await new Promise((resolve)=>setTimeout(resolve, delay));
                return fetchWithRetry(url, init, retriesLeft - 1);
            }
            return response;
        } catch (error) {
            if (retriesLeft > 0 && retry) {
                const delay = 1e3 * 2 ** (maxRetries - retriesLeft);
                await new Promise((resolve)=>setTimeout(resolve, delay));
                return fetchWithRetry(url, init, retriesLeft - 1);
            }
            throw error;
        }
    };
    const createUpload = async (file)=>{
        const headers = {
            "Content-Type": file.type || "application/octet-stream",
            "X-Chunked-Upload": "true",
            "X-Total-Size": String(file.size)
        };
        if (Object.keys(metadata).length > 0) {
            headers["X-File-Metadata"] = JSON.stringify(metadata);
        }
        if (file.name) {
            headers["Content-Disposition"] = `attachment; filename="${file.name}"`;
        }
        const response = await fetchWithRetry(endpoint, {
            body: new Uint8Array(0),
            // Empty body for initialization
            headers,
            method: "POST"
        });
        if (!response.ok) {
            throw new Error(`Failed to create upload session: ${response.status} ${response.statusText}`);
        }
        const fileId = response.headers.get("X-Upload-ID") || response.headers.get("Location")?.split("/").pop();
        if (!fileId) {
            throw new Error("Failed to get upload ID from server");
        }
        return fileId;
    };
    const getUploadStatus = async (fileId)=>{
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;
        const response = await fetchWithRetry(url, {
            method: "HEAD"
        });
        if (!response.ok) {
            throw new Error(`Failed to get upload status: ${response.status} ${response.statusText}`);
        }
        const offset = Number.parseInt(response.headers.get("X-Upload-Offset") || "0", 10);
        const chunksHeader = response.headers.get("X-Received-Chunks");
        let chunks = [];
        if (chunksHeader) {
            try {
                const parsed = JSON.parse(chunksHeader);
                if (Array.isArray(parsed)) {
                    chunks = parsed;
                }
            } catch  {}
        }
        return {
            chunks,
            offset
        };
    };
    const uploadChunk = async (file, fileId, startOffset, endOffset, signal)=>{
        const chunk = file.slice(startOffset, endOffset);
        const chunkSize2 = endOffset - startOffset;
        if (uploadState.uploadedChunks.has(startOffset)) {
            return;
        }
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;
        const response = await fetchWithRetry(url, {
            body: chunk,
            headers: {
                "Content-Length": String(chunkSize2),
                "Content-Type": "application/octet-stream",
                "X-Chunk-Offset": String(startOffset)
            },
            method: "PATCH",
            signal
        });
        if (!response.ok) {
            throw new Error(`Failed to upload chunk: ${response.status} ${response.statusText}`);
        }
        uploadState.uploadedChunks.add(startOffset);
        const currentOffset = Number.parseInt(response.headers.get("X-Upload-Offset") || String(endOffset), 10);
        const progress = Math.round(currentOffset / file.size * 100);
        progressCallback?.(progress, currentOffset);
    };
    const performUpload = async (file, fileId, signal)=>{
        const totalChunks = Math.ceil(file.size / chunkSize);
        const { chunks: serverChunks } = await getUploadStatus(fileId);
        for (const chunk of serverChunks){
            uploadState.uploadedChunks.add(chunk.offset);
        }
        const uploadPromises = [];
        for(let i = 0; i < totalChunks; i++){
            const startOffset = i * chunkSize;
            const endOffset = Math.min(startOffset + chunkSize, file.size);
            if (uploadState.uploadedChunks.has(startOffset)) {
                continue;
            }
            while(uploadState.paused && !uploadState.aborted){
                await new Promise((resolve)=>setTimeout(resolve, 100));
            }
            if (uploadState.aborted) {
                throw new Error("Upload aborted");
            }
            uploadPromises.push(uploadChunk(file, fileId, startOffset, endOffset, signal));
        }
        await Promise.all(uploadPromises);
        const finalStatus = await getUploadStatus(fileId);
        if (finalStatus.offset < file.size) {
            throw new Error(`Upload incomplete. Expected ${file.size} bytes, got ${finalStatus.offset}`);
        }
        const url = endpoint.endsWith("/") ? `${endpoint}${fileId}` : `${endpoint}/${fileId}`;
        const response = await fetchWithRetry(url, {
            method: "GET"
        });
        if (!response.ok) {
            throw new Error(`Failed to get upload result: ${response.status} ${response.statusText}`);
        }
        const fileMeta = await response.json();
        return {
            bytesWritten: fileMeta.bytesWritten || file.size,
            contentType: fileMeta.contentType || file.type,
            createdAt: fileMeta.createdAt,
            filename: fileMeta.originalName || file.name,
            id: fileMeta.id || fileId,
            metadata: fileMeta.metadata,
            name: fileMeta.name,
            originalName: fileMeta.originalName || file.name,
            size: fileMeta.size || file.size,
            status: fileMeta.status || "completed",
            url: fileMeta.url
        };
    };
    return {
        /**
     * Abort current upload
     */ abort: ()=>{
            uploadState.aborted = true;
            uploadState.paused = false;
            uploadState.abortController?.abort();
        },
        /**
     * Clear upload state
     */ clear: ()=>{
            uploadState = {
                abortController: void 0,
                aborted: false,
                paused: false,
                totalSize: 0,
                uploadedChunks: /* @__PURE__ */ new Set()
            };
        },
        /**
     * Get current upload offset
     */ getOffset: async ()=>{
            if (!uploadState.fileId) {
                return 0;
            }
            try {
                const status = await getUploadStatus(uploadState.fileId);
                return status.offset;
            } catch  {
                return [
                    ...uploadState.uploadedChunks
                ].reduce((sum, offset)=>{
                    const chunkEnd = Math.min(offset + chunkSize, uploadState.totalSize);
                    return sum + (chunkEnd - offset);
                }, 0);
            }
        },
        /**
     * Check if upload is paused
     */ isPaused: ()=>uploadState.paused,
        /**
     * Pause upload
     */ pause: ()=>{
            uploadState.paused = true;
        },
        /**
     * Resume upload
     */ resume: async ()=>{
            if (!uploadState.fileId || !uploadState.file) {
                throw new Error("No upload to resume");
            }
            uploadState.paused = false;
            const abortController = new AbortController();
            uploadState.abortController = abortController;
            try {
                const result = await performUpload(uploadState.file, uploadState.fileId, abortController.signal);
                finishCallback?.(result);
            } catch (error) {
                const uploadError = error instanceof Error ? error : new Error(String(error));
                errorCallback?.(uploadError);
                throw uploadError;
            }
        },
        /**
     * Set error callback
     */ setOnError: (callback)=>{
            errorCallback = callback;
        },
        /**
     * Set finish callback
     */ setOnFinish: (callback)=>{
            finishCallback = callback;
        },
        /**
     * Set progress callback
     */ setOnProgress: (callback)=>{
            progressCallback = callback;
        },
        /**
     * Set start callback
     */ setOnStart: (callback)=>{
            startCallback = callback;
        },
        /**
     * Upload a file in chunks
     */ upload: async (file)=>new Promise((resolve, reject)=>{
                let resolved = false;
                const originalFinishCallback = finishCallback;
                const originalErrorCallback = errorCallback;
                let timeoutId;
                const cleanupTimeout = ()=>{
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = void 0;
                    }
                    finishCallback = originalFinishCallback;
                    errorCallback = originalErrorCallback;
                };
                const internalFinishCallback = (result)=>{
                    if (!resolved) {
                        resolved = true;
                        cleanupTimeout();
                        originalFinishCallback?.(result);
                        resolve(result);
                    }
                };
                const internalErrorCallback = (error)=>{
                    if (!resolved) {
                        resolved = true;
                        cleanupTimeout();
                        originalErrorCallback?.(error);
                        reject(error);
                    }
                };
                finishCallback = internalFinishCallback;
                errorCallback = internalErrorCallback;
                uploadState = {
                    aborted: false,
                    file,
                    paused: false,
                    totalSize: file.size,
                    uploadedChunks: /* @__PURE__ */ new Set()
                };
                startCallback?.();
                (async ()=>{
                    try {
                        const abortController = new AbortController();
                        uploadState.abortController = abortController;
                        const fileId = await createUpload(file);
                        uploadState.fileId = fileId;
                        const result = await performUpload(file, fileId, abortController.signal);
                        internalFinishCallback(result);
                    } catch (error) {
                        const uploadError = error instanceof Error ? error : new Error(String(error));
                        internalErrorCallback(uploadError);
                    }
                })();
                timeoutId = setTimeout(()=>{
                    if (!resolved) {
                        uploadState.aborted = true;
                        cleanupTimeout();
                        internalErrorCallback(new Error("Upload timeout"));
                    }
                }, 3e5);
            })
    };
};
;
}),
"[project]/packages/storage-client/dist/packem_shared/useChunkedRestUpload-DOPSk-t6.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useChunkedRestUpload",
    ()=>useChunkedRestUpload
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createChunkedRestAdapter$2d$tTCb4Zfg$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/createChunkedRestAdapter-tTCb4Zfg.js [app-ssr] (ecmascript)");
;
;
const useChunkedRestUpload = (options)=>{
    const { chunkSize, endpoint, maxRetries, metadata, onError, onPause, onProgress, onResume, onStart, onSuccess, retry } = options;
    const [progress, setProgress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [isUploading, setIsUploading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isPaused, setIsPaused] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [offset, setOffset] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const adapterInstance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createChunkedRestAdapter$2d$tTCb4Zfg$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createChunkedRestAdapter"])({
            chunkSize,
            endpoint,
            maxRetries,
            metadata,
            retry
        }), [
        chunkSize,
        endpoint,
        maxRetries,
        metadata,
        retry
    ]);
    const callbacksRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])({
        onError,
        onPause,
        onProgress,
        onResume,
        onStart,
        onSuccess
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        callbacksRef.current = {
            onError,
            onPause,
            onProgress,
            onResume,
            onStart,
            onSuccess
        };
    }, [
        onError,
        onProgress,
        onPause,
        onResume,
        onStart,
        onSuccess
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        adapterInstance.setOnStart(()=>{
            setIsUploading(true);
            setIsPaused(false);
            setProgress(0);
            setError(null);
            setOffset(0);
            callbacksRef.current.onStart?.();
        });
        adapterInstance.setOnProgress((progressValue, offsetValue)=>{
            setProgress(progressValue);
            setOffset(offsetValue);
            callbacksRef.current.onProgress?.(progressValue, offsetValue);
        });
        adapterInstance.setOnFinish((uploadResult)=>{
            setProgress(100);
            setResult(uploadResult);
            setIsUploading(false);
            setIsPaused(false);
            callbacksRef.current.onSuccess?.(uploadResult);
        });
        adapterInstance.setOnError((uploadError)=>{
            setError(uploadError);
            setIsUploading(false);
            callbacksRef.current.onError?.(uploadError);
        });
        const checkInterval = setInterval(async ()=>{
            setOffset(await adapterInstance.getOffset());
            setIsPaused(adapterInstance.isPaused());
        }, 100);
        return ()=>{
            clearInterval(checkInterval);
            adapterInstance.setOnStart(void 0);
            adapterInstance.setOnProgress(void 0);
            adapterInstance.setOnFinish(void 0);
            adapterInstance.setOnError(void 0);
        };
    }, [
        adapterInstance
    ]);
    const upload = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (file)=>{
        try {
            return await adapterInstance.upload(file);
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));
            setError(uploadError);
            callbacksRef.current.onError?.(uploadError);
            throw uploadError;
        }
    }, [
        adapterInstance
    ]);
    const pause = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        adapterInstance.pause();
        setIsPaused(true);
        callbacksRef.current.onPause?.();
    }, [
        adapterInstance
    ]);
    const resume = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async ()=>{
        setIsPaused(false);
        setIsUploading(true);
        callbacksRef.current.onResume?.();
        try {
            await adapterInstance.resume();
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));
            setError(uploadError);
            setIsUploading(false);
            callbacksRef.current.onError?.(uploadError);
            throw uploadError;
        }
    }, [
        adapterInstance
    ]);
    const abort = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        adapterInstance.abort();
        setIsUploading(false);
        setIsPaused(false);
    }, [
        adapterInstance
    ]);
    const reset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        adapterInstance.clear();
        setProgress(0);
        setIsUploading(false);
        setIsPaused(false);
        setError(null);
        setResult(null);
        setOffset(0);
    }, [
        adapterInstance
    ]);
    return {
        abort,
        error,
        isPaused,
        isUploading,
        offset,
        pause,
        progress,
        reset,
        result,
        resume,
        upload
    };
};
;
}),
"[project]/packages/storage-client/dist/packem_shared/createUploader-DVuRBCmu.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Uploader",
    ()=>Uploader,
    "createUploader",
    ()=>createUploader
]);
class Uploader {
    constructor(options){
        this.options = options;
    }
    items = /* @__PURE__ */ new Map();
    eventHandlers = /* @__PURE__ */ new Map();
    activeUploads = /* @__PURE__ */ new Map();
    itemIdCounter = 0;
    /**
   * Generate unique item ID
   */ generateItemId() {
        this.itemIdCounter += 1;
        return `item-${Date.now()}-${this.itemIdCounter}`;
    }
    /**
   * Subscribe to uploader events
   */ on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, /* @__PURE__ */ new Set());
        }
        this.eventHandlers.get(event)?.add(handler);
    }
    /**
   * Unsubscribe from uploader events
   */ off(event, handler) {
        this.eventHandlers.get(event)?.delete(handler);
    }
    /**
   * Emit event to all registered handlers
   */ emit(event, item) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach((handler)=>{
                try {
                    handler(item);
                } catch (error) {
                    console.error(`[Uploader] Error in ${event} handler:`, error);
                }
            });
        }
    }
    /**
   * Create FormData for visulima multipart handler
   */ createFormData(file, metadata) {
        const formData = new FormData();
        formData.append("file", file);
        if (metadata && Object.keys(metadata).length > 0) {
            formData.append("metadata", JSON.stringify(metadata));
        }
        return formData;
    }
    /**
   * Parse response as FileMeta
   */ parseResponse(responseText, response) {
        try {
            const parsed = JSON.parse(responseText);
            return parsed;
        } catch  {
            const contentType = response instanceof XMLHttpRequest ? response.getResponseHeader("Content-Type") : response.headers.get("Content-Type");
            if (contentType?.includes("application/json")) {
                try {
                    return JSON.parse(responseText);
                } catch  {}
            }
            return {};
        }
    }
    /**
   * Upload a single file
   */ async uploadFile(item) {
        return new Promise((resolve, reject)=>{
            const xhr = new XMLHttpRequest();
            const formData = this.createFormData(item.file, this.options.metadata);
            this.activeUploads.set(item.id, xhr);
            item.status = "uploading";
            this.items.set(item.id, item);
            this.emit("ITEM_START", item);
            xhr.upload.addEventListener("progress", (event)=>{
                if (event.lengthComputable) {
                    const { loaded } = event;
                    const { total } = event;
                    const completed = Math.round(loaded / total * 100);
                    item.loaded = loaded;
                    item.completed = completed;
                    item.size = total;
                    this.items.set(item.id, item);
                    this.emit("ITEM_PROGRESS", item);
                }
            });
            xhr.addEventListener("load", ()=>{
                this.activeUploads.delete(item.id);
                if (xhr.status >= 200 && xhr.status < 300) {
                    const responseText = xhr.responseText || xhr.response;
                    const fileMeta = this.parseResponse(responseText, xhr);
                    item.status = "completed";
                    item.uploadResponse = {
                        data: fileMeta,
                        response: responseText
                    };
                    item.url = fileMeta.url || xhr.getResponseHeader("Location") || void 0;
                    this.items.set(item.id, item);
                    this.emit("ITEM_FINISH", item);
                    resolve();
                } else {
                    const error = new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`);
                    item.status = "error";
                    item.error = error.message;
                    this.items.set(item.id, item);
                    this.emit("ITEM_ERROR", item);
                    reject(error);
                }
            });
            xhr.addEventListener("error", ()=>{
                this.activeUploads.delete(item.id);
                const error = new Error("Network error during upload");
                item.status = "error";
                item.error = error.message;
                this.items.set(item.id, item);
                this.emit("ITEM_ERROR", item);
                reject(error);
            });
            xhr.addEventListener("abort", ()=>{
                this.activeUploads.delete(item.id);
                item.status = "aborted";
                this.items.set(item.id, item);
                reject(new Error("Upload aborted"));
            });
            xhr.open("POST", this.options.endpoint, true);
            if (this.options.metadata) {
                xhr.setRequestHeader("X-File-Metadata", JSON.stringify(this.options.metadata));
            }
            xhr.send(formData);
        });
    }
    /**
   * Add file to upload queue
   */ add(file) {
        const id = this.generateItemId();
        const item = {
            completed: 0,
            file,
            id,
            loaded: 0,
            size: file.size,
            status: "pending"
        };
        this.items.set(id, item);
        this.uploadFile(item).catch((error)=>{
            console.error(`[Uploader] Upload failed for item ${id}:`, error);
        });
        return id;
    }
    /**
   * Get item by ID
   */ getItem(id) {
        return this.items.get(id);
    }
    /**
   * Abort specific upload
   */ abortItem(id) {
        const xhr = this.activeUploads.get(id);
        if (xhr) {
            xhr.abort();
            this.activeUploads.delete(id);
        }
        const item = this.items.get(id);
        if (item) {
            item.status = "aborted";
            this.items.set(id, item);
        }
    }
    /**
   * Abort all uploads
   */ abort() {
        this.activeUploads.forEach((xhr, id)=>{
            xhr.abort();
            this.abortItem(id);
        });
        this.activeUploads.clear();
    }
    /**
   * Clear all items and abort active uploads
   */ clear() {
        this.abort();
        this.items.clear();
    }
    /**
   * Get all items
   */ getItems() {
        return [
            ...this.items.values()
        ];
    }
}
const createUploader = (options)=>new Uploader(options);
;
}),
"[project]/packages/storage-client/dist/packem_shared/createMultipartAdapter-C4lw0-Cz.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createMultipartAdapter",
    ()=>createMultipartAdapter
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createUploader$2d$DVuRBCmu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/createUploader-DVuRBCmu.js [app-ssr] (ecmascript)");
;
const createMultipartAdapter = (options)=>{
    const uploader = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createUploader$2d$DVuRBCmu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createUploader"])({
        endpoint: options.endpoint,
        maxRetries: options.maxRetries,
        metadata: options.metadata,
        retry: options.retry
    });
    return {
        /**
     * Aborts all uploads.
     */ abort: ()=>{
            uploader.abort();
        },
        /**
     * Clears all uploads.
     */ clear: ()=>{
            uploader.clear();
        },
        /**
     * Uploads a file and returns visulima-compatible result.
     */ upload: async (file)=>new Promise((resolve, reject)=>{
                let uploadResult;
                let resolved = false;
                const cleanup = ()=>{
                    uploader.off("ITEM_FINISH", onItemFinish);
                    uploader.off("ITEM_ERROR", onError);
                };
                const onItemFinish = (item)=>{
                    if (!resolved && item.file.name === file.name) {
                        let fileMeta = {};
                        try {
                            if (item.uploadResponse?.data && typeof item.uploadResponse.data === "object") {
                                fileMeta = item.uploadResponse.data;
                            } else if (item.uploadResponse?.response) {
                                fileMeta = JSON.parse(item.uploadResponse.response);
                            }
                        } catch  {}
                        uploadResult = {
                            bytesWritten: fileMeta.bytesWritten,
                            contentType: fileMeta.contentType ?? item.file.type,
                            createdAt: fileMeta.createdAt,
                            filename: fileMeta.originalName ?? item.file.name,
                            id: fileMeta.id ?? item.id,
                            metadata: fileMeta.metadata,
                            name: fileMeta.name,
                            originalName: fileMeta.originalName ?? item.file.name,
                            size: fileMeta.size ?? item.file.size,
                            status: fileMeta.status ?? "completed",
                            url: item.url
                        };
                        resolved = true;
                        cleanup();
                        resolve(uploadResult);
                    }
                };
                const onError = (item)=>{
                    if (!resolved && item.file.name === file.name) {
                        const error = new Error(item.error || "Upload failed");
                        resolved = true;
                        cleanup();
                        reject(error);
                    }
                };
                uploader.on("ITEM_FINISH", onItemFinish);
                uploader.on("ITEM_ERROR", onError);
                uploader.add(file);
                let timeoutId;
                const originalCleanup = cleanup;
                const cleanupWithTimeout = ()=>{
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = void 0;
                    }
                    originalCleanup();
                };
                timeoutId = setTimeout(()=>{
                    if (!resolved) {
                        resolved = true;
                        cleanupWithTimeout();
                        reject(new Error("Upload timeout"));
                    }
                }, 3e5);
                const originalOnItemFinish = onItemFinish;
                const originalOnError = onError;
                uploader.off("ITEM_FINISH", onItemFinish);
                uploader.off("ITEM_ERROR", onError);
                uploader.on("ITEM_FINISH", (item)=>{
                    originalOnItemFinish(item);
                    cleanupWithTimeout();
                });
                uploader.on("ITEM_ERROR", (item)=>{
                    originalOnError(item);
                    cleanupWithTimeout();
                });
            }),
        uploader
    };
};
;
}),
"[project]/packages/storage-client/dist/packem_shared/useMultipartUpload-DUl4df4A.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useMultipartUpload",
    ()=>useMultipartUpload
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createMultipartAdapter$2d$C4lw0$2d$Cz$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/createMultipartAdapter-C4lw0-Cz.js [app-ssr] (ecmascript)");
;
;
const useMultipartUpload = (options)=>{
    const { endpoint, metadata, onError, onProgress, onStart, onSuccess } = options;
    const uploaderInstance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createMultipartAdapter$2d$C4lw0$2d$Cz$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createMultipartAdapter"])({
            endpoint,
            metadata
        }), [
        endpoint,
        metadata
    ]);
    const [progress, setProgress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [isUploading, setIsUploading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(void 0);
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(void 0);
    const currentItemRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(void 0);
    const currentFileRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(void 0);
    const callbacksRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])({
        onError,
        onProgress,
        onStart,
        onSuccess
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        callbacksRef.current = {
            onError,
            onProgress,
            onStart,
            onSuccess
        };
    }, [
        onError,
        onProgress,
        onStart,
        onSuccess
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const { uploader } = uploaderInstance;
        const onItemProgress = (item)=>{
            if (item.id === currentItemRef.current) {
                const progressValue = Math.min(100, Math.max(0, item.completed));
                setProgress(progressValue);
                callbacksRef.current.onProgress?.(progressValue);
            }
        };
        const onItemStart = (item)=>{
            currentItemRef.current = item.id;
            currentFileRef.current = item.file;
            setIsUploading(true);
            setProgress(0);
            setError(void 0);
            callbacksRef.current.onStart?.();
        };
        const onItemFinish = (item)=>{
            if (item.id === currentItemRef.current) {
                let fileMeta = {};
                try {
                    if (item.uploadResponse?.data && typeof item.uploadResponse.data === "object") {
                        fileMeta = item.uploadResponse.data;
                    } else if (item.uploadResponse?.response) {
                        fileMeta = JSON.parse(item.uploadResponse.response);
                    }
                } catch  {}
                const uploadResult = {
                    bytesWritten: fileMeta.bytesWritten,
                    contentType: fileMeta.contentType ?? item.file.type,
                    createdAt: fileMeta.createdAt,
                    filename: fileMeta.originalName ?? item.file.name,
                    id: fileMeta.id ?? item.id,
                    metadata: fileMeta.metadata,
                    name: fileMeta.name,
                    originalName: fileMeta.originalName ?? item.file.name,
                    size: fileMeta.size ?? item.file.size,
                    status: fileMeta.status ?? "completed",
                    url: item.url
                };
                setProgress(100);
                setResult(uploadResult);
                setIsUploading(false);
                callbacksRef.current.onSuccess?.(uploadResult);
                currentItemRef.current = void 0;
                currentFileRef.current = void 0;
            }
        };
        const onUploadError = (item)=>{
            if (item.id === currentItemRef.current) {
                const uploadError = new Error(item.error || "Upload failed");
                setError(uploadError);
                setIsUploading(false);
                callbacksRef.current.onError?.(uploadError);
                currentItemRef.current = void 0;
            }
        };
        uploader.on("ITEM_START", onItemStart);
        uploader.on("ITEM_PROGRESS", onItemProgress);
        uploader.on("ITEM_FINISH", onItemFinish);
        uploader.on("ITEM_ERROR", onUploadError);
        return ()=>{
            uploader.off("ITEM_START", onItemStart);
            uploader.off("ITEM_PROGRESS", onItemProgress);
            uploader.off("ITEM_FINISH", onItemFinish);
            uploader.off("ITEM_ERROR", onUploadError);
        };
    }, [
        uploaderInstance
    ]);
    const upload = async (file)=>{
        try {
            return await uploaderInstance.upload(file);
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));
            setError(uploadError);
            callbacksRef.current.onError?.(uploadError);
            throw uploadError;
        }
    };
    const reset = ()=>{
        uploaderInstance.clear();
        setProgress(0);
        setIsUploading(false);
        setError(void 0);
        setResult(void 0);
        currentItemRef.current = void 0;
    };
    return {
        error,
        isUploading,
        progress,
        reset,
        result,
        upload
    };
};
;
}),
"[project]/packages/storage-client/dist/packem_shared/createTusAdapter-DnKwZsIz.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createTusAdapter",
    ()=>createTusAdapter
]);
const TUS_RESUMABLE_VERSION = "1.0.0";
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const encodeMetadata = (metadata)=>Object.entries(metadata).map(([key, value])=>{
        const encoded = btoa(unescape(encodeURIComponent(value)));
        return `${key} ${encoded}`;
    }).join(",");
const decodeMetadata = (header)=>{
    if (!header) {
        return {};
    }
    const metadata = {};
    header.split(",").forEach((item)=>{
        const [key, ...valueParts] = item.trim().split(" ");
        const encoded = valueParts.join(" ");
        if (key && encoded) {
            try {
                metadata[key] = decodeURIComponent(escape(atob(encoded)));
            } catch  {}
        }
    });
    return metadata;
};
const createTusAdapter = (options)=>{
    const { chunkSize = DEFAULT_CHUNK_SIZE, endpoint, maxRetries = 3, metadata = {}, retry = true } = options;
    let uploadState = null;
    let progressCallback;
    let startCallback;
    let finishCallback;
    let errorCallback;
    const createUpload = async (file)=>{
        const fileMetadata = {
            filename: file.name,
            filetype: file.type,
            ...metadata
        };
        const response = await fetch(endpoint, {
            headers: {
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
                "Upload-Length": file.size.toString(),
                "Upload-Metadata": encodeMetadata(fileMetadata)
            },
            method: "POST"
        });
        if (response.status !== 201 && response.status !== 200) {
            throw new Error(`Failed to create upload: ${response.status} ${response.statusText}`);
        }
        const location = response.headers.get("Location");
        if (!location) {
            throw new Error("No Location header in response");
        }
        let uploadUrl;
        if (location.startsWith("http")) {
            uploadUrl = location;
        } else {
            try {
                uploadUrl = new URL(location, endpoint).href;
            } catch  {
                const baseUrl = globalThis.window === void 0 ? "http://localhost" : globalThis.location.origin;
                uploadUrl = new URL(location, baseUrl + endpoint).href;
            }
        }
        const initialOffsetHeader = response.headers.get("Upload-Offset");
        const initialOffset = initialOffsetHeader ? Number.parseInt(initialOffsetHeader, 10) : 0;
        return {
            initialOffset,
            uploadUrl
        };
    };
    const getUploadOffset = async (uploadUrl)=>{
        const response = await fetch(uploadUrl, {
            headers: {
                "Tus-Resumable": TUS_RESUMABLE_VERSION
            },
            method: "HEAD"
        });
        if (!response.ok) {
            if (response.status === 404 || response.status === 410 || response.status === 403) {
                return 0;
            }
            throw new Error(`Failed to get upload offset: ${response.status} ${response.statusText}`);
        }
        const offsetHeader = response.headers.get("Upload-Offset");
        return offsetHeader ? Number.parseInt(offsetHeader, 10) : 0;
    };
    const uploadChunk = async (file, uploadUrl, startOffset, signal)=>{
        const endOffset = Math.min(startOffset + chunkSize, file.size);
        const chunk = file.slice(startOffset, endOffset);
        const response = await fetch(uploadUrl, {
            body: chunk,
            headers: {
                "Content-Length": chunk.size.toString(),
                // Explicitly set Content-Length as required by TUS protocol
                "Content-Type": "application/offset+octet-stream",
                "Tus-Resumable": TUS_RESUMABLE_VERSION,
                "Upload-Offset": startOffset.toString()
            },
            method: "PATCH",
            signal
        });
        if (response.status !== 204) {
            if (response.status === 409) {
                const currentOffset = await getUploadOffset(uploadUrl);
                return currentOffset;
            }
            if (response.status === 404 || response.status === 410) {
                throw new Error("Upload expired or not found");
            }
            if (response.status === 415) {
                throw new Error("Content-Type must be application/offset+octet-stream");
            }
            throw new Error(`Failed to upload chunk: ${response.status} ${response.statusText}`);
        }
        const newOffsetHeader = response.headers.get("Upload-Offset");
        if (!newOffsetHeader) {
            throw new Error("Missing Upload-Offset header in PATCH response");
        }
        return Number.parseInt(newOffsetHeader, 10);
    };
    const performUpload = async (file, uploadUrl, startOffset = 0)=>{
        if (!uploadState) {
            throw new Error("Upload state not initialized");
        }
        let currentOffset = startOffset;
        while(currentOffset < file.size){
            if (uploadState.isPaused) {
                await new Promise((resolve)=>{
                    const checkPause = ()=>{
                        if (uploadState?.isPaused) {
                            setTimeout(checkPause, 100);
                        } else {
                            resolve();
                        }
                    };
                    checkPause();
                });
            }
            if (uploadState.abortController.signal.aborted) {
                throw new Error("Upload aborted");
            }
            try {
                currentOffset = await uploadChunk(file, uploadUrl, currentOffset, uploadState.abortController.signal);
                uploadState.offset = currentOffset;
                const progressPercent = Math.round(currentOffset / file.size * 100);
                progressCallback?.(progressPercent, currentOffset);
            } catch (error_) {
                if (retry && uploadState.retryCount < maxRetries) {
                    uploadState.retryCount += 1;
                    await new Promise((resolve)=>setTimeout(resolve, 1e3 * uploadState.retryCount));
                    currentOffset = await getUploadOffset(uploadUrl);
                    continue;
                }
                throw error_;
            }
            uploadState.retryCount = 0;
        }
        const headResponse = await fetch(uploadUrl, {
            headers: {
                "Tus-Resumable": TUS_RESUMABLE_VERSION
            },
            method: "HEAD"
        });
        const location = headResponse.headers.get("Location") || uploadUrl;
        const uploadMetadata = decodeMetadata(headResponse.headers.get("Upload-Metadata"));
        let fileMeta = {};
        try {
            const contentType = headResponse.headers.get("Content-Type") || uploadMetadata.filetype || file.type;
            fileMeta = {
                contentType,
                id: uploadUrl.split("/").pop() || "",
                metadata: uploadMetadata,
                originalName: uploadMetadata.filename || file.name,
                size: file.size,
                status: "completed"
            };
        } catch  {}
        return {
            bytesWritten: currentOffset,
            contentType: fileMeta.contentType ?? file.type,
            createdAt: fileMeta.createdAt,
            filename: fileMeta.originalName ?? file.name,
            id: fileMeta.id ?? uploadUrl.split("/").pop() ?? "",
            metadata: fileMeta.metadata ?? uploadMetadata,
            name: fileMeta.name,
            offset: currentOffset,
            originalName: fileMeta.originalName ?? file.name,
            size: fileMeta.size ?? file.size,
            status: fileMeta.status ?? "completed",
            url: location
        };
    };
    return {
        /**
     * Abort the current upload
     */ abort: ()=>{
            if (uploadState) {
                uploadState.abortController.abort();
                uploadState = null;
            }
        },
        /**
     * Clear all uploads
     */ clear: ()=>{
            if (uploadState) {
                uploadState.abortController.abort();
                uploadState = null;
            }
        },
        /**
     * Get current upload offset
     */ getOffset: ()=>uploadState?.offset ?? 0,
        /**
     * Whether upload is paused
     */ isPaused: ()=>uploadState?.isPaused ?? false,
        /**
     * Pause the current upload
     */ pause: ()=>{
            if (uploadState) {
                uploadState.isPaused = true;
            }
        },
        /**
     * Resume a paused upload
     */ resume: async ()=>{
            if (!uploadState || !uploadState.uploadUrl) {
                throw new Error("No upload to resume");
            }
            uploadState.isPaused = false;
            try {
                const currentOffset = await getUploadOffset(uploadState.uploadUrl);
                uploadState.offset = currentOffset;
                progressCallback?.(Math.round(currentOffset / uploadState.file.size * 100), currentOffset);
                const uploadResult = await performUpload(uploadState.file, uploadState.uploadUrl, currentOffset);
                finishCallback?.(uploadResult);
            } catch (error_) {
                const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));
                errorCallback?.(uploadError);
                throw uploadError;
            }
        },
        /**
     * Set error callback
     */ setOnError: (callback)=>{
            errorCallback = callback;
        },
        /**
     * Set finish callback
     */ setOnFinish: (callback)=>{
            finishCallback = callback;
        },
        /**
     * Set progress callback
     */ setOnProgress: (callback)=>{
            progressCallback = callback;
        },
        /**
     * Set start callback
     */ setOnStart: (callback)=>{
            startCallback = callback;
        },
        /**
     * Upload a file and return visulima-compatible result
     */ upload: async (file)=>new Promise((resolve, reject)=>{
                let resolved = false;
                const originalFinishCallback = finishCallback;
                const originalErrorCallback = errorCallback;
                let timeoutId;
                const cleanupTimeout = ()=>{
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = void 0;
                    }
                    finishCallback = originalFinishCallback;
                    errorCallback = originalErrorCallback;
                };
                const internalFinishCallback = (result)=>{
                    if (!resolved) {
                        resolved = true;
                        cleanupTimeout();
                        originalFinishCallback?.(result);
                        uploadState = null;
                        resolve(result);
                    }
                };
                const internalErrorCallback = (error)=>{
                    if (!resolved) {
                        resolved = true;
                        cleanupTimeout();
                        originalErrorCallback?.(error);
                        if (!retry || uploadState && uploadState.retryCount >= maxRetries) {
                            uploadState = null;
                        }
                        reject(error);
                    }
                };
                finishCallback = internalFinishCallback;
                errorCallback = internalErrorCallback;
                uploadState = {
                    abortController: new AbortController(),
                    file,
                    isPaused: false,
                    offset: 0,
                    retryCount: 0,
                    uploadUrl: null
                };
                (async ()=>{
                    try {
                        startCallback?.();
                        let uploadUrl = uploadState?.uploadUrl;
                        if (uploadUrl) {
                            const currentOffset = await getUploadOffset(uploadUrl);
                            if (currentOffset > 0 && uploadState) {
                                uploadState.offset = currentOffset;
                                progressCallback?.(Math.round(currentOffset / file.size * 100), currentOffset);
                            }
                        } else {
                            const { initialOffset, uploadUrl: newUploadUrl } = await createUpload(file);
                            uploadUrl = newUploadUrl;
                            if (uploadState) {
                                uploadState.uploadUrl = uploadUrl;
                                uploadState.offset = initialOffset;
                                if (initialOffset > 0) {
                                    progressCallback?.(Math.round(initialOffset / file.size * 100), initialOffset);
                                }
                            }
                        }
                        if (!uploadState) {
                            throw new Error("Upload state lost");
                        }
                        const uploadResult = await performUpload(file, uploadUrl, uploadState.offset);
                        finishCallback(uploadResult);
                    } catch (error_) {
                        errorCallback(error_ instanceof Error ? error_ : new Error(String(error_)));
                    }
                })();
                timeoutId = setTimeout(()=>{
                    if (!resolved) {
                        resolved = true;
                        cleanupTimeout();
                        uploadState = null;
                        reject(new Error("Upload timeout"));
                    }
                }, 3e5);
            })
    };
};
;
}),
"[project]/packages/storage-client/dist/packem_shared/useTusUpload-5J-n5an0.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useTusUpload",
    ()=>useTusUpload
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createTusAdapter$2d$DnKwZsIz$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/createTusAdapter-DnKwZsIz.js [app-ssr] (ecmascript)");
;
;
const useTusUpload = (options)=>{
    const { chunkSize, endpoint, maxRetries, metadata, onError, onPause, onProgress, onResume, onStart, onSuccess, retry } = options;
    const [progress, setProgress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [isUploading, setIsUploading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isPaused, setIsPaused] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [offset, setOffset] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const adapterInstance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$createTusAdapter$2d$DnKwZsIz$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createTusAdapter"])({
            chunkSize,
            endpoint,
            maxRetries,
            metadata,
            retry
        }), [
        chunkSize,
        endpoint,
        maxRetries,
        metadata,
        retry
    ]);
    const callbacksRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])({
        onError,
        onPause,
        onProgress,
        onResume,
        onStart,
        onSuccess
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        callbacksRef.current = {
            onError,
            onPause,
            onProgress,
            onResume,
            onStart,
            onSuccess
        };
    }, [
        onError,
        onProgress,
        onPause,
        onResume,
        onStart,
        onSuccess
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        adapterInstance.setOnStart(()=>{
            setIsUploading(true);
            setIsPaused(false);
            setProgress(0);
            setError(null);
            setOffset(0);
            callbacksRef.current.onStart?.();
        });
        adapterInstance.setOnProgress((progressValue, offsetValue)=>{
            setProgress(progressValue);
            setOffset(offsetValue);
            callbacksRef.current.onProgress?.(progressValue);
        });
        adapterInstance.setOnFinish((uploadResult)=>{
            setProgress(100);
            setResult(uploadResult);
            setIsUploading(false);
            setIsPaused(false);
            callbacksRef.current.onSuccess?.(uploadResult);
        });
        adapterInstance.setOnError((uploadError)=>{
            setError(uploadError);
            setIsUploading(false);
            callbacksRef.current.onError?.(uploadError);
        });
        const checkInterval = setInterval(()=>{
            setOffset(adapterInstance.getOffset());
            setIsPaused(adapterInstance.isPaused());
        }, 100);
        return ()=>{
            clearInterval(checkInterval);
            adapterInstance.setOnStart(void 0);
            adapterInstance.setOnProgress(void 0);
            adapterInstance.setOnFinish(void 0);
            adapterInstance.setOnError(void 0);
        };
    }, [
        adapterInstance
    ]);
    const upload = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (file)=>{
        try {
            return await adapterInstance.upload(file);
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));
            setError(uploadError);
            callbacksRef.current.onError?.(uploadError);
            throw uploadError;
        }
    }, [
        adapterInstance
    ]);
    const pause = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        adapterInstance.pause();
        setIsPaused(true);
        callbacksRef.current.onPause?.();
    }, [
        adapterInstance
    ]);
    const resume = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async ()=>{
        setIsPaused(false);
        setIsUploading(true);
        callbacksRef.current.onResume?.();
        try {
            await adapterInstance.resume();
        } catch (error_) {
            const uploadError = error_ instanceof Error ? error_ : new Error(String(error_));
            setError(uploadError);
            setIsUploading(false);
            callbacksRef.current.onError?.(uploadError);
            throw uploadError;
        }
    }, [
        adapterInstance
    ]);
    const abort = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        adapterInstance.abort();
        setIsUploading(false);
        setIsPaused(false);
    }, [
        adapterInstance
    ]);
    const reset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        adapterInstance.clear();
        setProgress(0);
        setIsUploading(false);
        setIsPaused(false);
        setError(null);
        setResult(null);
        setOffset(0);
    }, [
        adapterInstance
    ]);
    return {
        abort,
        error,
        isPaused,
        isUploading,
        offset,
        pause,
        progress,
        reset,
        result,
        resume,
        upload
    };
};
;
}),
"[project]/packages/storage-client/dist/packem_shared/useUpload-BVyujc1s.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useUpload",
    ()=>useUpload
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useChunkedRestUpload$2d$DOPSk$2d$t6$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/useChunkedRestUpload-DOPSk-t6.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useMultipartUpload$2d$DUl4df4A$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/useMultipartUpload-DUl4df4A.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useTusUpload$2d$5J$2d$n5an0$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/useTusUpload-5J-n5an0.js [app-ssr] (ecmascript)");
;
;
;
;
const DEFAULT_TUS_THRESHOLD = 10 * 1024 * 1024;
const useUpload = (options)=>{
    const { chunkSize, endpointChunkedRest, endpointMultipart, endpointTus, maxRetries, metadata, method, onError, onPause, onProgress, onResume, onStart, onSuccess, retry, tusThreshold = DEFAULT_TUS_THRESHOLD } = options;
    const detectedMethod = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (method !== void 0) {
            return method;
        }
        const endpoints = [
            endpointChunkedRest,
            endpointMultipart,
            endpointTus
        ].filter(Boolean);
        if (endpoints.length === 1) {
            if (endpointChunkedRest) {
                return "chunked-rest";
            }
            if (endpointTus) {
                return "tus";
            }
            return "multipart";
        }
        if (endpoints.length > 1) {
            return "auto";
        }
        throw new Error("At least one endpoint must be provided: endpointChunkedRest, endpointMultipart, or endpointTus");
    }, [
        method,
        endpointChunkedRest,
        endpointMultipart,
        endpointTus
    ]);
    const chunkedRestOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!endpointChunkedRest) {
            return void 0;
        }
        return {
            chunkSize,
            endpoint: endpointChunkedRest,
            maxRetries,
            metadata,
            onError,
            onPause,
            onProgress,
            onResume,
            onStart,
            onSuccess,
            retry
        };
    }, [
        endpointChunkedRest,
        chunkSize,
        metadata,
        onStart,
        onSuccess,
        onError,
        onProgress,
        onPause,
        onResume,
        retry,
        maxRetries
    ]);
    const multipartOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!endpointMultipart) {
            return void 0;
        }
        return {
            endpoint: endpointMultipart,
            metadata,
            onError,
            onProgress,
            onStart,
            onSuccess
        };
    }, [
        endpointMultipart,
        metadata,
        onStart,
        onSuccess,
        onError,
        onProgress
    ]);
    const tusOptions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (!endpointTus) {
            return void 0;
        }
        return {
            chunkSize,
            endpoint: endpointTus,
            maxRetries,
            metadata,
            onError,
            onPause,
            onProgress,
            onResume,
            onStart,
            onSuccess,
            retry
        };
    }, [
        endpointTus,
        chunkSize,
        metadata,
        onStart,
        onSuccess,
        onError,
        onProgress,
        onPause,
        onResume,
        retry,
        maxRetries
    ]);
    const chunkedRestUpload = chunkedRestOptions ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useChunkedRestUpload$2d$DOPSk$2d$t6$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useChunkedRestUpload"])(chunkedRestOptions) : null;
    const multipartUpload = multipartOptions ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useMultipartUpload$2d$DUl4df4A$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMultipartUpload"])(multipartOptions) : null;
    const tusUpload = tusOptions ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useTusUpload$2d$5J$2d$n5an0$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTusUpload"])(tusOptions) : null;
    const determineMethod = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((file)=>{
        if (detectedMethod !== "auto") {
            return detectedMethod;
        }
        if (file.size > tusThreshold) {
            if (endpointTus) {
                return "tus";
            }
            if (endpointChunkedRest) {
                return "chunked-rest";
            }
        }
        if (endpointChunkedRest) {
            return "chunked-rest";
        }
        if (endpointMultipart) {
            return "multipart";
        }
        throw new Error("No available endpoint for upload");
    }, [
        detectedMethod,
        tusThreshold,
        endpointChunkedRest,
        endpointMultipart,
        endpointTus
    ]);
    const upload = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (file)=>{
        const selectedMethod = determineMethod(file);
        if (selectedMethod === "tus") {
            if (!tusUpload) {
                throw new Error("TUS endpoint not configured");
            }
            return tusUpload.upload(file);
        }
        if (selectedMethod === "chunked-rest") {
            if (!chunkedRestUpload) {
                throw new Error("Chunked REST endpoint not configured");
            }
            return chunkedRestUpload.upload(file);
        }
        if (!multipartUpload) {
            throw new Error("Multipart endpoint not configured");
        }
        return multipartUpload.upload(file);
    }, [
        determineMethod,
        tusUpload,
        chunkedRestUpload,
        multipartUpload
    ]);
    const abort = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        tusUpload?.abort();
        chunkedRestUpload?.abort();
        multipartUpload?.reset();
    }, [
        tusUpload,
        chunkedRestUpload,
        multipartUpload
    ]);
    const reset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        tusUpload?.reset();
        chunkedRestUpload?.reset();
        multipartUpload?.reset();
    }, [
        tusUpload,
        chunkedRestUpload,
        multipartUpload
    ]);
    const currentMethod = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        if (detectedMethod !== "auto") {
            return detectedMethod;
        }
        if (tusUpload && (tusUpload.isUploading || tusUpload.result)) {
            return "tus";
        }
        if (chunkedRestUpload && (chunkedRestUpload.isUploading || chunkedRestUpload.result)) {
            return "chunked-rest";
        }
        if (multipartUpload && (multipartUpload.isUploading || multipartUpload.result)) {
            return "multipart";
        }
        if (endpointChunkedRest) {
            return "chunked-rest";
        }
        if (endpointTus) {
            return "tus";
        }
        return "multipart";
    }, [
        detectedMethod,
        tusUpload,
        chunkedRestUpload,
        multipartUpload,
        endpointChunkedRest,
        endpointMultipart,
        endpointTus
    ]);
    return {
        abort,
        currentMethod,
        error: currentMethod === "tus" ? tusUpload?.error ?? null : currentMethod === "chunked-rest" ? chunkedRestUpload?.error ?? null : multipartUpload?.error ?? null,
        isPaused: currentMethod === "tus" ? tusUpload?.isPaused : currentMethod === "chunked-rest" ? chunkedRestUpload?.isPaused : void 0,
        isUploading: currentMethod === "tus" ? tusUpload?.isUploading ?? false : currentMethod === "chunked-rest" ? chunkedRestUpload?.isUploading ?? false : multipartUpload?.isUploading ?? false,
        offset: currentMethod === "tus" ? tusUpload?.offset : currentMethod === "chunked-rest" ? chunkedRestUpload?.offset : void 0,
        pause: currentMethod === "tus" ? tusUpload?.pause : currentMethod === "chunked-rest" ? chunkedRestUpload?.pause : void 0,
        progress: currentMethod === "tus" ? tusUpload?.progress ?? 0 : currentMethod === "chunked-rest" ? chunkedRestUpload?.progress ?? 0 : multipartUpload?.progress ?? 0,
        reset,
        result: currentMethod === "tus" ? tusUpload?.result ?? null : currentMethod === "chunked-rest" ? chunkedRestUpload?.result ?? null : multipartUpload?.result ?? null,
        resume: currentMethod === "tus" ? tusUpload?.resume : currentMethod === "chunked-rest" ? chunkedRestUpload?.resume : void 0,
        upload
    };
};
;
}),
"[project]/packages/storage-client/examples/nextjs/app/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useUpload$2d$BVyujc1s$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/dist/packem_shared/useUpload-BVyujc1s.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
;
;
function Home() {
    const [file, setFile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const { error, isUploading, progress, result, upload } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$dist$2f$packem_shared$2f$useUpload$2d$BVyujc1s$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useUpload"])({
        endpointMultipart: "/api/upload/multipart",
        endpointTus: "/api/upload/tus",
        onError: (error)=>{
            console.error("Upload error:", error);
        },
        onSuccess: (result)=>{
            console.log("Upload successful:", result);
        }
    });
    const handleFileChange = (e)=>{
        const selectedFile = e.target.files?.[0];
        setFile(selectedFile || null);
    };
    const handleUpload = async ()=>{
        if (file) {
            try {
                await upload(file);
            } catch (error_) {
                console.error("Upload failed:", error_);
            }
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Storage Client - Next.js Example"
            }, void 0, false, {
                fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                lineNumber: 37,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    marginTop: "2rem"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        disabled: isUploading,
                        onChange: handleFileChange,
                        type: "file"
                    }, void 0, false, {
                        fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                        lineNumber: 39,
                        columnNumber: 17
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        disabled: !file || isUploading,
                        onClick: handleUpload,
                        style: {
                            marginLeft: "1rem"
                        },
                        children: isUploading ? "Uploading..." : "Upload"
                    }, void 0, false, {
                        fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                        lineNumber: 40,
                        columnNumber: 17
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                lineNumber: 38,
                columnNumber: 13
            }, this),
            isUploading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    marginTop: "1rem"
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            "Progress:",
                            progress,
                            "%"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                        lineNumber: 46,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("progress", {
                        max: 100,
                        value: progress
                    }, void 0, false, {
                        fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                        lineNumber: 51,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                lineNumber: 45,
                columnNumber: 17
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    color: "red",
                    marginTop: "1rem"
                },
                children: [
                    "Error:",
                    error.message
                ]
            }, void 0, true, {
                fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                lineNumber: 55,
                columnNumber: 17
            }, this),
            result && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$0$2e$3_$40$opentelemetry$2b$api$40$1$2e$9$2e$0_$40$playwright$2b$test$40$1$2e$56$2e$1_react$2d$dom$40$19$2e$2$2e$0_react$40$19$2e$2$2e$0_$5f$react$40$19$2e$2$2e$0$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    color: "green",
                    marginTop: "1rem"
                },
                children: [
                    "Upload complete! File:",
                    result.filename
                ]
            }, void 0, true, {
                fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
                lineNumber: 61,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/packages/storage-client/examples/nextjs/app/page.tsx",
        lineNumber: 36,
        columnNumber: 9
    }, this);
}
}),
"[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    else {
        if ("TURBOPACK compile-time truthy", 1) {
            if ("TURBOPACK compile-time truthy", 1) {
                module.exports = __turbopack_context__.r("[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)");
            } else //TURBOPACK unreachable
            ;
        } else //TURBOPACK unreachable
        ;
    }
} //# sourceMappingURL=module.compiled.js.map
}),
"[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].ReactJsxDevRuntime; //# sourceMappingURL=react-jsx-dev-runtime.js.map
}),
"[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

module.exports = __turbopack_context__.r("[project]/node_modules/.pnpm/next@16.0.3_@opentelemetry+api@1.9.0_@playwright+test@1.56.1_react-dom@19.2.0_react@19.2.0__react@19.2.0/node_modules/next/dist/server/route-modules/app-page/module.compiled.js [app-ssr] (ecmascript)").vendored['react-ssr'].React; //# sourceMappingURL=react.js.map
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__c4b83e06._.js.map