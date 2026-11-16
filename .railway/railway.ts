import { defineRailway, project, service } from "railway/iac";

// Replaces the root railway.json (Config as Code stops being read on 2026-12-01).
// This repository manages only its own service in the project; other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "app";

export default defineRailway(() => {
  const app = service("app", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/api/health",
    healthcheckTimeout: 180,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5 },
    replicas: { iad: 1 },
  });

  return project("korkem-demo", {
    // Variables stay managed in the Railway dashboard, not in this file.
    variables: { managed: false },
    resources: [app],
  });
});
