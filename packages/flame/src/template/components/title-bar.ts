const titleBar = (title: string, hint?: string): string => {
    return `
    <div class="w-full flex flex-col items-center justify-center">
        <div class="text-4xl font-bold">${title}</div>
        ${hint ? `<div class="text-xl text-gray-600">${hint}</div>` : ""}
    </div>
    `;
}

export default titleBar;
