<div align="center">
  <h3>Visulima health-check</h3>
  <p>
  A library built to provide support for defining service health for node services. It allows you to register async health checks for your dependencies and the service itself, provides a health endpoint that exposes their status, and health metrics.

It’s built on top of

[pingman](https://github.com/dopecodez/pingman),
[node:http](https://nodejs.org/api/http.html),
[cacheable-lookup](https://github.com/szmarczak/cacheable-lookup),
[node:process.env](https://nodejs.org/docs/latest/api/process.html#process_process_env)

  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

<div align="center">
  <sub>Built with ❤︎ by <a href="https://twitter.com/_prisis_">Daniel Bannert</a></sub>
</div>

## Installation

```sh
npm install @visulima/health-check
```

```sh
yarn add @visulima/health-check
```

```sh
pnpm add @visulima/health-check
```

## Usecases for API health check endpoints

Keeping the API health check endpoints generic allows to use them for multiple purposes. In this section, we will review of the everyday use cases of an API health check endpoint

- Container orchestrators and API load balancers can use API health check endpoint to find out about the process status
- Usage of memory, disk, and other server resources can be monitored via API health check endpoints
- Health checks can test APIs dependencies, such as databases and external service endpoints, to confirm availability and normal functioning.

## Usage

```ts
import { healthCheckHandler, HealthCheck as HealthCheck, nodeEnvironmentCheck } from "@visulima/health-check";

const HealthCheckService = new HealthCheck();

HealthCheckService.addChecker("node-env", nodeEnvironmentCheck);

export default healthCheckHandler(HealthCheckService); // returns a http handler
```

### API health check endpoint types

There are at least three different types of API health check endpoints designed to serve specific purposes.

- _The readiness endpoint_, often available via `/health/ready`, returns the readiness state to accept incoming requests from the gateway or the upstream proxy. Readiness signals that the app is running normally but isn’t ready to receive requests yet.

- _The liveness endpoint_, often available via `/health/live`, returns the liveness of a microservice. If the check does not return the expected response, it means that the process is unhealthy or dead and should be replaced as soon as possible.

- _The generic health check endpoint_, often available via `/health`, returns the status of the service and the dependencies.

Consider the following example: an API that loads JSON-based data into memory to serve requests.

The `/health/ready` continues to respond with `NOT_READY` signal while the API is loading the JSON file since the API cannot serve any request without the file in memory. Therefore, it may take time for the API to process the entire file.

The `/health/live` immediately signals `LIVE`, even though the app is not ready, to prevent the container orchestrator layer from restarting the app.

> ### Consider protecting your health check endpoint
>
> Most ping endpoints are publicly available because they don’t provide much internal or sensitive information. On the other hand, API health check endpoints expose information about your service, so it’s a good idea to protect this endpoint. You only need to make sure that your API monitoring tool supports sending API access keys.

### Built-in Checks

The library comes with a set of built-in checks. Currently implemented checks are as follows:

#### Node Environment Check

This check verifies that the node environment is set to production.
This check is useful for ensuring that the node environment is set to production in production environments or only that the NODE_ENV is set.

```ts
import { nodeEnvironmentCheck } from "@visulima/health-check";

nodeEnvironmentCheck(); // check if NODE_ENV is set
nodeEnvironmentCheck("production"); // check if NODE_ENV is set to production
```

#### HTTP built-in check

The HTTP check allows you to trigger an HTTP request to one of your dependencies, and verify the response status, and optionally the content of the response body.

```ts
import { httpCheck } from "@visulima/health-check";

httpCheck("https://example.com", {
    fetchOptions: {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        // ... any other options you want to pass to node-fetch
    },
    expected: {
        status: 200,
        body: "OK",
    },
});
```

#### DNS built-in check(s)

The DNS checks allow you to perform lookup to a given hostname / domain name / CNAME / etc, and validate that it resolves to at least the minimum number of required results.

```ts
import { dnsCheck } from "@visulima/health-check";

dnsCheck("example.com", ["1.1.1.1"], {
    family: "all",
    // ... other options for cacheable-lookup
});
```

#### Ping built-in check(s)

The ping checks allow you to verifies that a resource is still alive and reachable. For example, you can use it as a DB ping check to verify that your DB is still alive and reachable.

```ts
import { pingCheck } from "@visulima/health-check";

pingCheck("example.com", {
    timeout: 1000,
    // ... other options for pingman
});
```

#### Custom Checks

The library provides Check interface that you can implement to create your own custom checks.

```ts
type Checker = () => Promise<HealthReportEntry>;

/**
 * Shape of health report entry. Each checker must
 * return an object with similar shape.
 */
type HealthReportEntry = {
    displayName: string;
    health: {
        healthy: boolean;
        message?: string;
        timestamp: string;
    };
    meta?: any;
};
```

#### Expose Health Endpoint

The library provides an HTTP handler function for serving health stats in JSON format. You can register it using your favorite HTTP implementation like so:

```ts
import { handleHealthCheck } from "@visulima/health-check";

export default handleHealthCheck();
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima health-check is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/ "TypeScript" "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/health-check?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/health-check/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/health-check/v/latest "npm"
