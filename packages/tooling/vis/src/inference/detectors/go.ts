import type { DetectContext, DetectedTargets, Detector } from "../types";

/**
 * Applies only to Go modules (a `go.mod` in a module listed by `go.work`);
 * `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run from the module directory. `build`, `test` and `vet` use the go tool
 * over `./...`. `format:check` is `gofmt -d .`: `-d` prints the diff and exits 1 when a file
 * needs formatting, while `gofmt -l` exits 0 even with output, so it is not used.
 * `gofmt` also walks `vendor/` if the module has one. Checks are `type: "test"`, with
 * no outputs. POSIX only: the commands are not verified on Windows.
 */
const inputs = ["{projectRoot}/**/*.go", "{projectRoot}/go.mod", "{projectRoot}/go.sum", "{workspaceRoot}/go.work", "{workspaceRoot}/go.work.sum"];

export const goDetector: Detector = {
    configFiles: ["go.mod"],
    detect: (_context: DetectContext): DetectedTargets => {
        return {
            targets: {
                build: {
                    cache: false,
                    command: "go build ./...",
                    description: "go build (inferred)",
                    inputs,
                },
                "format:check": {
                    command: "gofmt -d .",
                    description: "gofmt check (inferred)",
                    inputs,
                    outputs: [],
                    type: "test",
                },
                test: {
                    command: "go test ./...",
                    description: "go test (inferred)",
                    inputs,
                    outputs: [],
                    type: "test",
                },
                vet: {
                    command: "go vet ./...",
                    description: "go vet (inferred)",
                    inputs,
                    outputs: [],
                    type: "test",
                },
            },
        };
    },
    name: "go",
};
