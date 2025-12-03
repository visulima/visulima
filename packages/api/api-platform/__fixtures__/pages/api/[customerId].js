export default async function handler(request, res) {
    const { method } = request;

    let result;
    switch (method) {
        case "GET": {
            res.json({});
            break;
        }

        case "DELETE": {
            res.json({});
            break;
        }

        case "POST": {
            res.json({});
            break;
        }

        default: {
            res.status(405).end(`Method ${method} Not Allowed`);
        }
    }
}
