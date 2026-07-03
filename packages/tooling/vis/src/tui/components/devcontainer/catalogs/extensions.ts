export type ExtensionCategory = "debugging" | "formatting" | "git" | "language" | "linting" | "other" | "testing";

export interface ExtensionCatalogEntry {
    category: ExtensionCategory;
    description: string;
    id: string;
    name: string;
}

export const EXTENSION_CATALOG: ExtensionCatalogEntry[] = [
    // Linting
    {
        category: "linting",
        description: "Integrates ESLint into the editor",
        id: "dbaeumer.vscode-eslint",
        name: "ESLint",
    },
    {
        category: "linting",
        description: "Stylelint CSS/SCSS linting",
        id: "stylelint.vscode-stylelint",
        name: "Stylelint",
    },

    // Formatting
    {
        category: "formatting",
        description: "Opinionated code formatter",
        id: "esbenp.prettier-vscode",
        name: "Prettier",
    },
    {
        category: "formatting",
        description: "EditorConfig file support",
        id: "editorconfig.editorconfig",
        name: "EditorConfig",
    },
    {
        category: "formatting",
        description: "Fast Rust-based formatter and linter",
        id: "biomejs.biome",
        name: "Biome",
    },

    // Language
    {
        category: "language",
        description: "Rich TypeScript and JavaScript support",
        id: "ms-vscode.vscode-typescript-next",
        name: "TypeScript Nightly",
    },
    {
        category: "language",
        description: "Tailwind CSS IntelliSense",
        id: "bradlc.vscode-tailwindcss",
        name: "Tailwind CSS",
    },
    {
        category: "language",
        description: "YAML language support with schemas",
        id: "redhat.vscode-yaml",
        name: "YAML",
    },
    {
        category: "language",
        description: "TOML language support",
        id: "tamasfe.even-better-toml",
        name: "TOML",
    },
    {
        category: "language",
        description: "Dockerfile and Docker Compose support",
        id: "ms-azuretools.vscode-docker",
        name: "Docker",
    },
    {
        category: "language",
        description: "Python language support with Pylance",
        id: "ms-python.python",
        name: "Python",
    },
    {
        category: "language",
        description: "Go language support",
        id: "golang.go",
        name: "Go",
    },
    {
        category: "language",
        description: "Rust language support via rust-analyzer",
        id: "rust-lang.rust-analyzer",
        name: "rust-analyzer",
    },

    // Git
    {
        category: "git",
        description: "Git supercharged: blame, history, stash, etc.",
        id: "eamodio.gitlens",
        name: "GitLens",
    },
    {
        category: "git",
        description: "GitHub Pull Requests and Issues",
        id: "github.vscode-pull-request-github",
        name: "GitHub PR",
    },

    // Testing
    {
        category: "testing",
        description: "Vitest test explorer integration",
        id: "vitest.explorer",
        name: "Vitest Explorer",
    },
    {
        category: "testing",
        description: "Jest test runner and assertions",
        id: "orta.vscode-jest",
        name: "Jest",
    },

    // Debugging
    {
        category: "debugging",
        description: "REST client for testing APIs",
        id: "humao.rest-client",
        name: "REST Client",
    },
    {
        category: "debugging",
        description: "Error Lens: inline error highlighting",
        id: "usernamehw.errorlens",
        name: "Error Lens",
    },

    // Other
    {
        category: "other",
        description: "Intelligent code completion with AI",
        id: "github.copilot",
        name: "GitHub Copilot",
    },
    {
        category: "other",
        description: "Path autocompletion for imports",
        id: "christian-kohler.path-intellisense",
        name: "Path Intellisense",
    },
    {
        category: "other",
        description: "Import cost display in editor",
        id: "wix.vscode-import-cost",
        name: "Import Cost",
    },
    {
        category: "other",
        description: "Todo Tree: highlight and list TODOs",
        id: "gruntfuggly.todo-tree",
        name: "Todo Tree",
    },
];
