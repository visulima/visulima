import { useContext } from "react";
import StderrContext, { type Props } from "../components/StderrContext.js";

/**
A React hook that returns the stderr stream.
*/
const useStderr = (): Props => useContext(StderrContext);
export default useStderr;
