import type { DevcontainerConfig } from "../types";

export interface DevcontainerTemplate {
    config: DevcontainerConfig;
    description: string;
    id: string;
    name: string;
}

export const TEMPLATES: DevcontainerTemplate[] = [
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
                },
            },
            features: {
                "ghcr.io/devcontainers/features/git:1": {},
                "ghcr.io/devcontainers/features/github-cli:1": {},
            },
            forwardPorts: [3000],
            image: "mcr.microsoft.com/devcontainers/javascript-node:22",
            name: "Node.js",
            postCreateCommand: "npm install",
        },
        description: "Node.js 22 with Git and GitHub CLI",
        id: "node",
        name: "Node.js",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
                },
            },
            features: {
                "ghcr.io/devcontainers/features/git:1": {},
                "ghcr.io/devcontainers/features/github-cli:1": {},
            },
            forwardPorts: [3000],
            image: "mcr.microsoft.com/devcontainers/javascript-node:22",
            mounts: [
                {
                    source: "${localWorkspaceFolderBasename}-node_modules",
                    target: "${containerWorkspaceFolder}/node_modules",
                    type: "volume",
                },
                {
                    source: "${localWorkspaceFolderBasename}-pnpm-store",
                    target: "/home/node/.local/share/pnpm/store",
                    type: "volume",
                },
            ],
            name: "Node.js + pnpm Monorepo",
            postCreateCommand: "corepack enable && pnpm install",
            remoteUser: "node",
            workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
        },
        description: "Node.js 22 with pnpm, corepack, and optimized volume mounts",
        id: "node-pnpm",
        name: "Node.js + pnpm",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "ms-azuretools.vscode-docker"],
                },
            },
            dockerComposeFile: "docker-compose.yml",
            forwardPorts: [3000, 5432],
            name: "Node.js + PostgreSQL",
            postCreateCommand: "npm install",
            service: "app",
            workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
        },
        description: "Node.js with PostgreSQL via Docker Compose",
        id: "node-postgres",
        name: "Node.js + PostgreSQL",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "ms-azuretools.vscode-docker"],
                },
            },
            features: {
                "ghcr.io/devcontainers/features/docker-in-docker:2": {},
                "ghcr.io/devcontainers/features/git:1": {},
                "ghcr.io/devcontainers/features/github-cli:1": {},
            },
            forwardPorts: [3000],
            image: "mcr.microsoft.com/devcontainers/javascript-node:22",
            name: "Node.js + Docker",
            postCreateCommand: "npm install",
        },
        description: "Node.js 22 with Docker-in-Docker for container workflows",
        id: "node-dind",
        name: "Node.js + Docker-in-Docker",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "ms-azuretools.vscode-docker"],
                },
            },
            dockerComposeFile: "docker-compose.yml",
            features: {
                "ghcr.io/devcontainers/features/docker-in-docker:2": {},
            },
            forwardPorts: [3000, 5432, 6379],
            name: "Full Stack",
            postCreateCommand: "npm install",
            service: "app",
            workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
        },
        description: "Node.js + PostgreSQL + Redis + Docker via Compose",
        id: "fullstack",
        name: "Full Stack",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["ms-python.python", "ms-python.vscode-pylance"],
                    settings: {
                        "editor.formatOnSave": true,
                        "python.defaultInterpreterPath": "/usr/local/bin/python",
                    },
                },
            },
            features: {
                "ghcr.io/devcontainers/features/git:1": {},
                "ghcr.io/devcontainers/features/github-cli:1": {},
                "ghcr.io/devcontainers/features/python:1": { version: "3.12" },
            },
            forwardPorts: [8000],
            image: "mcr.microsoft.com/devcontainers/python:3.12",
            name: "Python",
            postCreateCommand: "pip install -r requirements.txt || true",
        },
        description: "Python 3.12 with pip and venv",
        id: "python",
        name: "Python",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["golang.go"],
                    settings: {
                        "editor.formatOnSave": true,
                        "go.toolsManagement.autoUpdate": true,
                    },
                },
            },
            features: {
                "ghcr.io/devcontainers/features/git:1": {},
                "ghcr.io/devcontainers/features/go:1": { version: "1.22" },
            },
            forwardPorts: [8080],
            image: "mcr.microsoft.com/devcontainers/go:1.22",
            name: "Go",
            postCreateCommand: "go mod download || true",
        },
        description: "Go 1.22 development environment",
        id: "go",
        name: "Go",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["rust-lang.rust-analyzer", "tamasfe.even-better-toml"],
                    settings: {
                        "editor.formatOnSave": true,
                    },
                },
            },
            features: {
                "ghcr.io/devcontainers/features/git:1": {},
                "ghcr.io/devcontainers/features/rust:1": {},
            },
            image: "mcr.microsoft.com/devcontainers/rust:latest",
            name: "Rust",
            postCreateCommand: "cargo build || true",
        },
        description: "Rust development with cargo and rust-analyzer",
        id: "rust",
        name: "Rust",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["vscjava.vscode-java-pack", "vscjava.vscode-maven"],
                },
            },
            features: {
                "ghcr.io/devcontainers/features/git:1": {},
                "ghcr.io/devcontainers/features/java:1": { version: "17" },
            },
            forwardPorts: [8080],
            image: "mcr.microsoft.com/devcontainers/java:17",
            name: "Java",
            postCreateCommand: "./mvnw install || ./gradlew build || true",
        },
        description: "Java 17 with Maven/Gradle support",
        id: "java",
        name: "Java",
    },
    {
        config: {
            customizations: {
                vscode: {
                    extensions: ["ms-azuretools.vscode-docker", "ms-kubernetes-tools.vscode-kubernetes-tools", "hashicorp.terraform"],
                },
            },
            features: {
                "ghcr.io/devcontainers/features/aws-cli:1": {},
                "ghcr.io/devcontainers/features/azure-cli:1": {},
                "ghcr.io/devcontainers/features/docker-in-docker:2": {},
                "ghcr.io/devcontainers/features/kubectl-helm-minikube:1": {},
                "ghcr.io/devcontainers/features/terraform:1": {},
            },
            image: "mcr.microsoft.com/devcontainers/base:ubuntu",
            name: "DevOps",
        },
        description: "Docker, Kubernetes, Terraform, AWS & Azure CLIs",
        id: "devops",
        name: "DevOps",
    },
    {
        config: {
            features: {
                "ghcr.io/devcontainers/features/common-utils:2": {},
            },
            image: "mcr.microsoft.com/devcontainers/base:ubuntu",
            name: "Minimal",
            remoteUser: "vscode",
        },
        description: "Bare Ubuntu with common utilities",
        id: "minimal",
        name: "Minimal",
    },
    {
        config: {
            image: "mcr.microsoft.com/devcontainers/base:ubuntu",
            name: "Custom",
        },
        description: "Minimal Ubuntu base - configure from scratch",
        id: "custom",
        name: "Custom (Blank)",
    },
];
