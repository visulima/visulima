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
                    extensions: [
                        "dbaeumer.vscode-eslint",
                        "esbenp.prettier-vscode",
                    ],
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
                    extensions: [
                        "dbaeumer.vscode-eslint",
                        "esbenp.prettier-vscode",
                    ],
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
                    extensions: [
                        "dbaeumer.vscode-eslint",
                        "esbenp.prettier-vscode",
                        "ms-azuretools.vscode-docker",
                    ],
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
                    extensions: [
                        "dbaeumer.vscode-eslint",
                        "esbenp.prettier-vscode",
                        "ms-azuretools.vscode-docker",
                    ],
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
                    extensions: [
                        "dbaeumer.vscode-eslint",
                        "esbenp.prettier-vscode",
                        "ms-azuretools.vscode-docker",
                    ],
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
            image: "mcr.microsoft.com/devcontainers/base:ubuntu",
            name: "Custom",
        },
        description: "Minimal Ubuntu base - configure from scratch",
        id: "custom",
        name: "Custom (Blank)",
    },
];
