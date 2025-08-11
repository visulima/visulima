declare module "*.svg?data-uri" {
    const content: string;

    export default content;
}

declare module "lucide-static/icons/*.svg?data-uri" {
    const content: string;

    export default content;
}

declare module "*.svg?raw" {
    const content: string;

    export default content;
}

declare module "lucide-static/icons/*.svg?raw" {
    const content: string;

    export default content;
}