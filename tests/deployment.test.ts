import { expect, test } from "vitest";
import { type DeploymentConfig, validateDeployment } from "../scripts/deployment.ts";

const config: DeploymentConfig = {
  name: "mochi",
  vars: { BETTER_AUTH_URL: "https://mochi.example.com", PUBLIC_OWNER_NAME: "Ryoga" },
  d1_databases: [{ binding: "DB", database_id: "12345678-1234-1234-1234-123456789abc" }],
  r2_buckets: [{ binding: "ASSETS_BUCKET", bucket_name: "mochi-assets" }],
};

test("accepts a configured production build", () => {
  expect(validateDeployment(config)).toEqual([]);
});

test("rejects development builds, placeholder IDs and missing bindings before remote operations", () => {
  expect(validateDeployment({ ...config, name: "mochi-local" })).toContainEqual(
    expect.stringContaining("本番用ビルド"),
  );
  for (const database_id of ["", "placeholder", "00000000-0000-0000-0000-000000000000"])
    expect(validateDeployment({ ...config, d1_databases: [{ binding: "DB", database_id }] })).toContainEqual(
      expect.stringContaining("database_id"),
    );
  expect(validateDeployment({ ...config, d1_databases: [] })).toContainEqual(expect.stringContaining("database_id"));
  expect(validateDeployment({ ...config, r2_buckets: [] })).toContainEqual(expect.stringContaining("ASSETS_BUCKET"));
});

test.each([
  undefined,
  "http://localhost:3000",
  "https://replace-me.invalid",
  "https://mochi.example.com/",
  "https://mochi.example.com/path",
  "https://mochi.example.com?query=1",
  "https://mochi.example.com#fragment",
  "https://user:password@mochi.example.com",
])("rejects invalid or noncanonical OAuth origins: %s", (BETTER_AUTH_URL) => {
  expect(validateDeployment({ ...config, vars: { ...config.vars, BETTER_AUTH_URL } })).toContainEqual(
    expect.stringContaining("BETTER_AUTH_URL"),
  );
});
