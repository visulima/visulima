/* eslint-disable react/destructuring-assignment, sonarjs/function-return-type, sonarjs/public-static-readonly */

import type { ReactNode } from "react";
import { PureComponent } from "react";

import { toError } from "../ink/to-error";
import ErrorOverview from "./error-overview";

type Props = {
    readonly children: ReactNode;
    readonly onError: (error: Error) => void;
};

type State = {
    readonly error?: Error;
};

// Error boundary must be a class component since getDerivedStateFromError
// and componentDidCatch are not available as hooks
export default class ErrorBoundary extends PureComponent<Props, State> {
    // fallow-ignore-next-line unused-class-member -- consumed by React DevTools / the runtime, not called in-repo.
    static displayName = "InternalErrorBoundary";

    // Any thrown value (a string, `undefined`, an error from another realm) becomes an Error,
    // so the fallback always renders and the exit promise rejects with a real error.
    static getDerivedStateFromError(error: unknown): State {
        return { error: toError(error) };
    }

    override state: State = {
        error: undefined,
    };

    override componentDidCatch(): void {
        this.props.onError(this.state.error!);
    }

    override render(): ReactNode {
        if (this.state.error) {
            return <ErrorOverview error={this.state.error} />;
        }

        return this.props.children;
    }
}

export type { Props as ErrorBoundaryProps };
