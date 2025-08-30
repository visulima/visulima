export type Solution = {
    body: string;
    header?: string;
};

export type Theme = "dark" | "light";
export enum Editor {
    appcode = "AppCode",
    "android-studio" = "Android Studio",
    atom = "Atom",
    "atom-beta" = "Atom Beta",
    brackets = "Brackets",
    clion = "CLion",
    code = "Visual Studio Code",
    "code-insiders" = "Visual Studio Code Insiders",
    codium = "VSCodium",
    cursor = "Cursor",
    emacs = "GNU Emacs",
    emacsforosx = "GNU Emacs for Mac OS X",
    intellij = "IntelliJ IDEA",
    idea = "IntelliJ IDEA",
    nano = "GNU nano",
    neovim = "NeoVim",
    "notepad++" = "Notepad++",
    phpstorm = "PhpStorm",
    pycharm = "PyCharm",
    rider = "Rider",
    rubymine = "RubyMine",
    sublime = "SublimeText",
    textmate = "TextMate",
    vim = "Vim",
    visualstudio = "Visual Studio",
    vscode = "Visual Studio Code",
    vscodium = "VSCodium",
    webstorm = "WebStorm",
    xcode = "Xcode",
    zed = "Zed",
}

export type SolutionFinderFile = {
    file: string;
    language?: string;
    line: number;
    snippet?: string | undefined;
};

export type SolutionFinder = {
    handle: (error: any, file: SolutionFinderFile) => Promise<Solution | undefined>;
    name: string;
    priority: number;
};

export type SolutionError = Error & {
    hint?: Solution;
};
