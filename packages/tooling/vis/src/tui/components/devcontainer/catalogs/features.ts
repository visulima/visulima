export type FeatureCategory = "cloud" | "database" | "language" | "other" | "tool";

export interface FeatureCatalogEntry {
    category: FeatureCategory;
    description: string;
    id: string;
    name: string;
}

export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
    // Languages
    {
        category: "language",
        description: "Node.js runtime via nvm with optional pnpm/yarn",
        id: "ghcr.io/devcontainers/features/node:1",
        name: "Node.js",
    },
    {
        category: "language",
        description: "Python runtime with pip and optional tools",
        id: "ghcr.io/devcontainers/features/python:1",
        name: "Python",
    },
    {
        category: "language",
        description: "Go compiler and tools",
        id: "ghcr.io/devcontainers/features/go:1",
        name: "Go",
    },
    {
        category: "language",
        description: "Rust toolchain via rustup",
        id: "ghcr.io/devcontainers/features/rust:1",
        name: "Rust",
    },
    {
        category: "language",
        description: "Java runtime and JDK via SDKMAN",
        id: "ghcr.io/devcontainers/features/java:1",
        name: "Java",
    },
    {
        category: "language",
        description: ".NET SDK and runtime",
        id: "ghcr.io/devcontainers/features/dotnet:2",
        name: ".NET",
    },

    // Tools
    {
        category: "tool",
        description: "Common utilities: zsh, Oh My Zsh, git, curl, etc.",
        id: "ghcr.io/devcontainers/features/common-utils:2",
        name: "Common Utilities",
    },
    {
        category: "tool",
        description: "Git version control",
        id: "ghcr.io/devcontainers/features/git:1",
        name: "Git",
    },
    {
        category: "tool",
        description: "Git Large File Storage support",
        id: "ghcr.io/devcontainers/features/git-lfs:1",
        name: "Git LFS",
    },
    {
        category: "tool",
        description: "GitHub CLI for repository management",
        id: "ghcr.io/devcontainers/features/github-cli:1",
        name: "GitHub CLI",
    },
    {
        category: "tool",
        description: "Run Docker containers inside the dev container",
        id: "ghcr.io/devcontainers/features/docker-in-docker:2",
        name: "Docker-in-Docker",
    },
    {
        category: "tool",
        description: "Access host Docker daemon from inside the container",
        id: "ghcr.io/devcontainers/features/docker-outside-of-docker:1",
        name: "Docker-from-Docker",
    },
    {
        category: "tool",
        description: "kubectl, Helm, and Minikube for Kubernetes",
        id: "ghcr.io/devcontainers/features/kubectl-helm-minikube:1",
        name: "Kubernetes Tools",
    },
    {
        category: "tool",
        description: "Infrastructure as code with Terraform",
        id: "ghcr.io/devcontainers/features/terraform:1",
        name: "Terraform",
    },
    {
        category: "tool",
        description: "Nix package manager",
        id: "ghcr.io/devcontainers/features/nix:1",
        name: "Nix",
    },
    {
        category: "tool",
        description: "SSH server for remote connections to the container",
        id: "ghcr.io/devcontainers/features/sshd:1",
        name: "SSH Server",
    },

    // Cloud
    {
        category: "cloud",
        description: "Amazon Web Services CLI v2",
        id: "ghcr.io/devcontainers/features/aws-cli:1",
        name: "AWS CLI",
    },
    {
        category: "cloud",
        description: "Microsoft Azure CLI",
        id: "ghcr.io/devcontainers/features/azure-cli:1",
        name: "Azure CLI",
    },
    {
        category: "cloud",
        description: "Google Cloud Platform CLI",
        id: "ghcr.io/devcontainers/features/gcloud:1",
        name: "Google Cloud CLI",
    },

    // Databases
    {
        category: "database",
        description: "PostgreSQL client tools",
        id: "ghcr.io/devcontainers-extra/features/postgres-client:1",
        name: "PostgreSQL Client",
    },
    {
        category: "database",
        description: "Redis client tools",
        id: "ghcr.io/devcontainers-extra/features/redis-client:1",
        name: "Redis Client",
    },
];
