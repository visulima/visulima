const layout = (title: string, description: string, css: string, content: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${description}">
    ${css ? `<style>${css}</style>` : ""}
</head>
<body>
    <div class="container mx-auto">
        <div class="flex flex-wrap">
            ${content}
        </div>
    </div>
</body>
</html>
`;

export default layout;
