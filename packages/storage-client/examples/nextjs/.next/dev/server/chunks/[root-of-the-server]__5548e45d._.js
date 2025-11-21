module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/packages/storage-client/examples/nextjs/lib/storage.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "storage",
    ()=>storage
]);
(()=>{
    const e = new Error("Cannot find module '@visulima/storage'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
const storage = new DiskStorage({
    directory: "./uploads",
    maxUploadSize: "100MB",
    logger: console
});
}),
"[project]/packages/storage-client/examples/nextjs/app/api/upload/multipart/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "POST",
    ()=>POST
]);
(()=>{
    const e = new Error("Cannot find module '@visulima/storage/handler/http/fetch'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$examples$2f$nextjs$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/storage-client/examples/nextjs/lib/storage.ts [app-route] (ecmascript)");
;
;
const multipart = new Multipart({
    storage: __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$storage$2d$client$2f$examples$2f$nextjs$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["storage"]
});
async function POST(request) {
    try {
        return await multipart.fetch(request);
    } catch (error) {
        console.error("Multipart upload error:", error);
        return Response.json({
            error: error.message || "Upload failed"
        }, {
            status: error.statusCode || 500
        });
    }
}
async function DELETE(request) {
    try {
        return await multipart.fetch(request);
    } catch (error) {
        console.error("Delete error:", error);
        return Response.json({
            error: error.message || "Delete failed"
        }, {
            status: error.statusCode || 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__5548e45d._.js.map