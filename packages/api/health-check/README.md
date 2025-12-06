<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="health-check" />

</a>

<h3 align="center">A library built to provide support for defining service health for node services. It allows you to register async health checks for your dependencies and the service itself, provides a health endpoint that exposes their status, and health metrics.</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

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

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima health-check is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/health-check?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/health-check?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/health-check
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
