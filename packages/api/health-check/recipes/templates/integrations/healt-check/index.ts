import { HealthCheck, nodeEnvCheck } from "@visulima/health-check";

const HealthCheckService = new HealthCheck();

HealthCheckService.addChecker("node-env", nodeEnvCheck());

export default HealthCheckService;
