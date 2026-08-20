import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collectionsRoot = path.join(apiRoot, "directus-config", "collections");

async function readJson(name) {
  const contents = await readFile(path.join(collectionsRoot, `${name}.json`), "utf8");
  return JSON.parse(contents);
}

function isObjectOrNull(value) {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertUniqueSyncIds(items, name) {
  const syncIds = new Set();

  for (const item of items) {
    assert(
      typeof item._syncId === "string" && item._syncId.length > 0,
      `${name} contains an item without a valid _syncId.`,
    );
    assert(!syncIds.has(item._syncId), `${name} contains duplicate _syncId ${item._syncId}.`);
    syncIds.add(item._syncId);
  }

  return syncIds;
}

export function validateDirectusConfig({ permissions, policies, roles }) {
  assert(Array.isArray(permissions), "permissions.json must contain an array.");
  assert(Array.isArray(policies), "policies.json must contain an array.");
  assert(Array.isArray(roles), "roles.json must contain an array.");

  assertUniqueSyncIds(permissions, "permissions.json");
  const policyIds = assertUniqueSyncIds(policies, "policies.json");
  const roleIds = assertUniqueSyncIds(roles, "roles.json");

  const publicAccesses = [];

  for (const policy of policies) {
    assert(Array.isArray(policy.roles), `Policy ${policy._syncId} must contain a roles array.`);

    for (const access of policy.roles) {
      assert(isObjectOrNull(access), `Policy ${policy._syncId} contains an invalid role access.`);

      if (access.role === null && access.user === null) {
        publicAccesses.push(policy._syncId);
      } else if (access.role !== null) {
        assert(
          roleIds.has(access.role),
          `Policy ${policy._syncId} references unknown role ${access.role}.`,
        );
      }
    }
  }

  assert(
    publicAccesses.length === 1 && publicAccesses[0] === "_sync_default_public_policy",
    "Public access must be represented exactly once by _sync_default_public_policy; do not attach another policy with role=null and user=null.",
  );

  for (const permission of permissions) {
    assert(
      policyIds.has(permission.policy),
      `Permission ${permission._syncId} references unknown policy ${permission.policy}.`,
    );

    for (const property of ["permissions", "validation", "presets"]) {
      assert(
        isObjectOrNull(permission[property]),
        `Permission ${permission._syncId} has an invalid ${property}; Directus expects an object or null.`,
      );
    }

    assert(
      Array.isArray(permission.fields) &&
        permission.fields.every((field) => typeof field === "string" && field.length > 0),
      `Permission ${permission._syncId} must contain a valid fields array.`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [permissions, policies, roles] = await Promise.all([
    readJson("permissions"),
    readJson("policies"),
    readJson("roles"),
  ]);

  validateDirectusConfig({ permissions, policies, roles });
  console.log("Directus Sync access-control configuration is valid.");
}
