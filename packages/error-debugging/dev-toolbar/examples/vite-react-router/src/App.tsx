import "./App.css";

import { useState } from "react";
import { Link, Route, Routes } from "react-router";

import viteLogo from "../../../../../../../../../../../vite.svg";
import reactLogo from "./assets/react.svg";

function Home() {
    const [count, setCount] = useState(0);

    const throwError = () => {
        setTimeout(() => {
            const cause = new TypeError("Cannot read properties of undefined (reading 'name')");
            const error = new Error("Example client error thrown from the React Router dev-toolbar demo");

            error.cause = cause;
            throw error;
        }, 0);
    };

    const rejectPromise = () => {
        void Promise.reject(new Error("Example unhandled Promise rejection from the React Router dev-toolbar demo"));
    };

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
            <h1>Vite + React Router + Dev Toolbar</h1>
            <div className="card">
                <button onClick={() => setCount((c) => c + 1)} type="button">
                    count is {count}
                </button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <div className="card">
                <button onClick={throwError} type="button">
                    Throw Error
                </button>{" "}
                <button onClick={rejectPromise} type="button">
                    Unhandled Rejection
                </button>
            </div>
            <p className="read-the-docs">
                <Link to="/about">Go to About</Link>
            </p>
        </>
    );
}

function About() {
    const triggerError = () => {
        const cause = new ReferenceError("undeclaredVariable is not defined");
        const error = new Error("Error triggered from the About page");

        error.cause = cause;
        throw error;
    };

    return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
            <h1>About</h1>
            <p>This page demonstrates React Router navigation with the Dev Toolbar.</p>
            <div className="card">
                <button onClick={triggerError} type="button">
                    Trigger Error on About Page
                </button>
            </div>
            <p className="read-the-docs">
                <Link to="/">Back to Home</Link>
            </p>
        </div>
    );
}

function App() {
    return (
        <Routes>
            <Route element={<Home />} path="/" />
            <Route element={<About />} path="/about" />
        </Routes>
    );
}

export default App;
