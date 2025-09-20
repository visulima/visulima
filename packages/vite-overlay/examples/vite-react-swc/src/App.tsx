import "./App.css";

import { useState } from "react";

import viteLogo from "/vite.svg";
import reactLogo from "./assets/react.svg";

function App() {
    const [count, setCount] = useState(0);

    throw new Error("This is a error message", {
        cause: new Error("This is a error message 22"),
    });

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img alt="Vite logo" className="logo" src={viteLogo} />
                </a>
                <a href="https://react.dev" target="_blank">
                    <img alt="React logo" className="logo react" src={reactLogo} />
                </a>
            </div>
            <h1>Vite + React</h1>
            <div className="card">
                <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
}

export default App;
