import type { GrpcObject } from "@grpc/grpc-js";
import type { PackageDefinition } from "@grpc/proto-loader";

import { BYTESTREAM_PROTO, REMOTE_EXECUTION_PROTO } from "./sources";

/**
 * REAPI-flavoured gRPC client surface returned by {@link loadReapiProto}.
 *
 * Each entry is a constructor pulled from the package descriptor — call
 * `new` with the channel target and credentials to get a typed client
 * with the unary / streaming RPC methods bound.
 *
 * The methods themselves are not strongly typed here (gRPC's runtime
 * reflection has no static counterpart we can mirror without
 * codegen) — call sites in {@link ../reapi.ts} narrow request /
 * response shapes via `as` casts pinned to the proto field names.
 */
export interface ReapiGrpcClients {
    ActionCache: new (target: string, credentials: unknown, options?: unknown) => GrpcClientLike;
    ByteStream: new (target: string, credentials: unknown, options?: unknown) => GrpcClientLike;
    Capabilities: new (target: string, credentials: unknown, options?: unknown) => GrpcClientLike;
    ContentAddressableStorage: new (target: string, credentials: unknown, options?: unknown) => GrpcClientLike;
}

export interface GrpcClientLike {
    [method: string]: unknown;
    close: () => void;
    waitForReady?: (deadline: number, callback: (error?: Error) => void) => void;
}

/**
 * Cached package definition + loaded gRPC object. Computed once per
 * process so a fleet of `ReapiRemoteCache` instances share one
 * compiled proto descriptor — protobufjs's parse + resolveAll is
 * non-trivial work and there's no per-instance state.
 */
let cached: { clients: ReapiGrpcClients; definition: PackageDefinition } | undefined;

/**
 * Lazily load `@grpc/proto-loader` + `@grpc/grpc-js`. Both are listed
 * as optional peer dependencies; throwing here gives us a single
 * obvious error message when REAPI is selected without the deps
 * available, instead of the cryptic `MODULE_NOT_FOUND` from a deeper
 * import frame.
 */
const importGrpc = async (): Promise<{ grpc: typeof import("@grpc/grpc-js"); protoLoader: typeof import("@grpc/proto-loader") }> => {
    let grpc: typeof import("@grpc/grpc-js");
    let protoLoader: typeof import("@grpc/proto-loader");

    try {
        grpc = await import("@grpc/grpc-js");
    } catch (error) {
        throw new Error(
            '[task-runner] remoteCache.backend = "reapi" needs the optional peer dependency `@grpc/grpc-js`. ' +
                'Install it with `pnpm add @grpc/grpc-js` (or your package manager\'s equivalent), or switch to backend: "http".',
            { cause: error },
        );
    }

    try {
        protoLoader = await import("@grpc/proto-loader");
    } catch (error) {
        throw new Error(
            '[task-runner] remoteCache.backend = "reapi" needs the optional peer dependency `@grpc/proto-loader`. ' +
                'Install it with `pnpm add @grpc/proto-loader` (or your package manager\'s equivalent), or switch to backend: "http".',
            { cause: error },
        );
    }

    return { grpc, protoLoader };
};

/**
 * Parse the embedded proto sources via protobufjs (transitively
 * available through `@grpc/proto-loader`), then turn the resulting
 * descriptor into a `PackageDefinition` proto-loader's `fromJSON`
 * understands. This matches what `protoLoader.loadSync(filename)`
 * would have done if the protos lived on disk — but the strings live
 * in the bundle, so `dist/` ships without any non-JS assets.
 */
export const loadReapiProto = async (): Promise<{ clients: ReapiGrpcClients; grpc: typeof import("@grpc/grpc-js") }> => {
    const { grpc, protoLoader } = await importGrpc();

    if (cached === undefined) {
        let protobufjs: typeof import("protobufjs");

        try {
            // eslint-disable-next-line import/no-extraneous-dependencies -- transitively provided by @grpc/proto-loader; surfaced here so we can vendor the proto descriptor
            protobufjs = await import("protobufjs");
        } catch (error) {
            throw new Error(
                '[task-runner] remoteCache.backend = "reapi" needs `protobufjs` (normally installed transitively via `@grpc/proto-loader`). ' +
                    "Install it with `pnpm add protobufjs` (or your package manager's equivalent) if your installer does not hoist transitive deps.",
                { cause: error },
            );
        }

        const { parse, Root } = protobufjs;
        const root = new Root();

        parse(REMOTE_EXECUTION_PROTO, root, { keepCase: true });
        parse(BYTESTREAM_PROTO, root, { keepCase: true });
        root.resolveAll();

        const json = root.toJSON();

        const definition = protoLoader.fromJSON(json, {
            arrays: true,
            defaults: true,
            enums: String,
            keepCase: true,
            longs: Number,
            objects: true,
            oneofs: true,
        });

        const loaded = grpc.loadPackageDefinition(definition) as unknown as GrpcObject & {
            build: { bazel: { remote: { execution: { v2: ReapiGrpcClients } } } };
            google: { bytestream: { ByteStream: ReapiGrpcClients["ByteStream"] } };
        };

        const reapi = loaded.build.bazel.remote.execution.v2;
        const byteStream = loaded.google.bytestream;

        cached = {
            clients: {
                ActionCache: reapi.ActionCache,
                ByteStream: byteStream.ByteStream,
                Capabilities: reapi.Capabilities,
                ContentAddressableStorage: reapi.ContentAddressableStorage,
            },
            definition,
        };
    }

    return { clients: cached.clients, grpc };
};

/**
 * Reset the module-level cache. Test-only — keeps the public API
 * deterministic when a suite stands up multiple stub gRPC servers
 * across describe blocks.
 * @internal
 */
export const resetReapiProtoCache = (): void => {
    cached = undefined;
};
