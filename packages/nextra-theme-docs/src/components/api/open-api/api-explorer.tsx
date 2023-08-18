const ApiExplorer = ({ data, ...props }) => {
    return (
        <div>
            <pre>
                <code>{JSON.stringify(data, null, 2)}</code>
            </pre>
        </div>
    );
};
