import type { FC, ReactElement, SVGAttributes } from "react";
import type { supportedLanguages } from "@readme/oas-to-snippet";
import type { Language } from "prism-react-renderer";

import ClojureIcon from "../../../../../icons/language/clojure";
import CplusplusIcon from "../../../../../icons/language/cplusplus";
import CSharpIcon from "../../../../../icons/language/csharp";
import GoIcon from "../../../../../icons/language/go";
import JavaIcon from "../../../../../icons/language/java";
import JavascriptIcon from "../../../../../icons/language/javascript";
import JsonIcon from "../../../../../icons/language/json";
import ShellIcon from "../../../../../icons/language/shell";
import SwiftIcon from "../../../../../icons/language/swift";
import KotlinIcon from "../../../../../icons/language/kotlin";
import NodejsIcon from "../../../../../icons/language/nodejs";
import ObjectiveCIcon from "../../../../../icons/language/objectivec";
import OCamlIcon from "../../../../../icons/language/ocaml";
import PhpIcon from "../../../../../icons/language/php";
import PowershellIcon from "../../../../../icons/language/powershell";
import PythonIcon from "../../../../../icons/language/python";
import RIcon from "../../../../../icons/language/r";
import RubyIcon from "../../../../../icons/language/ruby";
import HttpIcon from "../../../../../icons/language/http";
import CIcon from "../../../../../icons/language/c";

const axios = (
    <>
        <p>npm install axios --save</p>
        <p>yarn add axios</p>
        <p>pnpm add axios</p>
    </>
);

export const iconMap: Record<keyof typeof supportedLanguages | "curl" | "node-simple", FC<SVGAttributes<SVGElement>>> = {
    c: CIcon,
    clojure: ClojureIcon,
    cplusplus: CplusplusIcon,
    csharp: CSharpIcon,
    curl: ShellIcon,
    go: GoIcon,
    http: HttpIcon,
    java: JavaIcon,
    javascript: JavascriptIcon,
    json: JsonIcon,
    kotlin: KotlinIcon,
    node: NodejsIcon,
    "node-simple": NodejsIcon,
    objectivec: ObjectiveCIcon,
    ocaml: OCamlIcon,
    php: PhpIcon,
    powershell: PowershellIcon,
    python: PythonIcon,
    r: RIcon,
    ruby: RubyIcon,
    shell: ShellIcon,
    swift: SwiftIcon,
};

export const snippedLanguageToPrismLanguage: Record<string, Language> = {
    cplusplus: "cpp",
    curl: "bash",
    node: "javascript",
    "node-simple": "javascript",
    shell: "shell-session",
};

export const installGuide: Record<string, ReactElement | string> = {
    csharp_restsharp: "dotnet add package RestSharp",
    javascript_axios: axios,
    node_api: (
        <>
            <p>npm install api --save</p>
            <p>yarn add api</p>
            <p>pnpm add api</p>
        </>
    ),
    node_axios: axios,
    node_fetch: (
        <>
            <p>npm install node-fetch@3 --save</p>
            <p>yarn add node-fetch@3</p>
            <p>pnpm add node-fetch@3</p>
        </>
    ),
    node_request: (
        <>
            <strong>This package has been deprecated</strong>
            <p>npm install request --save</p>
            <p>yarn add request</p>
            <p>pnpm add request</p>
        </>
    ),
    php_guzzle: "composer require guzzlehttp/guzzle",
    python_requests: "python -m pip install requests",
    shell_httpie: "brew install httpie",
};
