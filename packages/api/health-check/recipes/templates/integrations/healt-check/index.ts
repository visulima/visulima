import { HealthCheck, nodeEnvironmentCheck } from "@visulima/health-check";

const HealthCheckService = new HealthCheck();

HealthCheckService.addChecker("node-env", nodeEnvironmentCheck);

export default HealthCheckService;
