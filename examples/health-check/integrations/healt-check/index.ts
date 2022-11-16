import { HealthCheck, nodeEnvCheck, httpCheck, pingCheck, dnsCheck } from "@visulima/health-check";

const HealthCheckService = new HealthCheck();

HealthCheckService.addChecker("ping-example-health-check", pingCheck("example.com", {}));
HealthCheckService.addChecker("http-example-health-check", httpCheck("https://example.com", {}));
HealthCheckService.addChecker("dns-example-health-check", dnsCheck("example.com"));
HealthCheckService.addChecker("node-env", nodeEnvCheck());

export default HealthCheckService;
