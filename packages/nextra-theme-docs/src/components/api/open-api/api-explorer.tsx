const ApiExplorer = ({ data, ...properties }) => (
    <div>
        <pre>
            <code>{JSON.stringify(data, null, 2)}</code>
        </pre>
    </div>
);
