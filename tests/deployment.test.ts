import { expect, test } from "vitest";
import { type DeploymentConfig, validateDeployment } from "../scripts/deployment.ts";
import { workerConfig } from "../scripts/worker-config.ts";

const config: DeploymentConfig = {
  name: "mochi",
  vars: { BETTER_AUTH_URL: "https://mochi.example.com", PUBLIC_OWNER_NAME: "Ryoga" },
  d1_databases: [{ binding: "DB", database_id: "12345678-1234-1234-1234-123456789abc" }],
  r2_buckets: [{ binding: "ASSETS_BUCKET", bucket_name: "mochi-assets" }],
};

test("accepts a configured production build", () => {
  expect(validateDeployment(config)).toEqual([]);
});

test("local config never binds production resources even when deployment variables are set", () => {
  const config = workerConfig(false, {
    CLOUDFLARE_ACCOUNT_ID: "production-account",
    CLOUDFLARE_D1_DATABASE_ID: "production-db",
    BETTER_AUTH_URL: "https://example.com",
    CLOUDFLARE_R2_BUCKET: "production-images",
  });
  expect(config.name).toBe("mochi-local");
  expect(config.d1_databases[0].database_id).toBe("00000000-0000-0000-0000-000000000000");
  expect(config.r2_buckets[0].bucket_name).toBe("mochi-assets");
  expect(config.account_id).toBeUndefined();
  expect(config.routes).toBeUndefined();
});

test("production config uses deployment variables and never includes secret values", () => {
  const config = workerConfig(true, {
    CLOUDFLARE_ACCOUNT_ID: "account",
    CLOUDFLARE_D1_DATABASE_ID: "12345678-1234-1234-1234-123456789abc",
    BETTER_AUTH_URL: "https://mochi.example.com",
    CLOUDFLARE_R2_BUCKET: "images",
    PUBLIC_OWNER_NAME: "Owner",
    BETTER_AUTH_SECRET: "private-secret",
    CLOUDFLARE_API_TOKEN: "private-token",
  });
  expect(validateDeployment(config)).toEqual([]);
  expect(config.routes).toEqual([{ pattern: "mochi.example.com", custom_domain: true }]);
  expect(config.vars.PUBLIC_OWNER_NAME).toBe("Owner");
  expect(config.r2_buckets[0].bucket_name).toBe("images");
  expect(JSON.stringify(config)).not.toMatch(/private-secret|private-token/);
});

test("rejects development builds, placeholder IDs and missing bindings before remote operations", () => {
  expect(validateDeployment({ ...config, name: "mochi-local" })).toContainEqual(
    expect.stringContaining("本番用ビルド"),
  );
  for (const database_id of ["", "placeholder", "00000000-0000-0000-0000-000000000000"])
    expect(validateDeployment({ ...config, d1_databases: [{ binding: "DB", database_id }] })).toContainEqual(
      expect.stringContaining("CLOUDFLARE_D1_DATABASE_ID"),
    );
  expect(validateDeployment({ ...config, d1_databases: [] })).toContainEqual(
    expect.stringContaining("CLOUDFLARE_D1_DATABASE_ID"),
  );
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
