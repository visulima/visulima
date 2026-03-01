import "./App.css";

import { useState } from "react";
import { Link, Route, Routes } from "react-router";

import viteLogo from "/vite.svg";
import reactLogo from "./assets/react.svg";

function Home() {
    const [count, setCount] = useState(0);

    const throwError = () => {
        setTimeout(() => {
            const cause = new TypeError("Cannot read properties of undefined (reading 'name')");
            const err = new Error("Example client error thrown from the React Router dev-toolbar demo");

            err.cause = cause;
            throw err;
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
                <button type="button" onClick={() => setCount((c) => c + 1)}>
                    count is {count}
                </button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <div className="card">
                <button type="button" onClick={throwError}>
                    Throw Error
                </button>{" "}
                <button type="button" onClick={rejectPromise}>
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
        const err = new Error("Error triggered from the About page");

        err.cause = cause;
        throw err;
    };

    return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
            <h1>About</h1>
            <p>This page demonstrates React Router navigation with the Dev Toolbar.</p>
            <div className="card">
                <button type="button" onClick={triggerError}>
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
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
        </Routes>
    );
}

export default App;
