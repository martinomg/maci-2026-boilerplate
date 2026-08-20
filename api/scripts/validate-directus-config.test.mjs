import assert from "node:assert/strict";
import test from "node:test";

import { validateDirectusConfig } from "./validate-directus-config.mjs";

const publicPolicy = {
  _syncId: "_sync_default_public_policy",
  roles: [{ role: null, user: null, sort: 1 }],
};

const publicPermission = {
  _syncId: "public-posts-read",
  policy: "_sync_default_public_policy",
  permissions: { status: { _eq: "published" } },
  validation: null,
  presets: null,
  fields: ["id", "status"],
};

test("accepts one reserved public policy with object filters", () => {
  assert.doesNotThrow(() =>
    validateDirectusConfig({
      permissions: [publicPermission],
      policies: [publicPolicy],
      roles: [],
    }),
  );
});

test("rejects a second role-null public policy", () => {
  assert.throws(
    () =>
      validateDirectusConfig({
        permissions: [publicPermission],
        policies: [
          publicPolicy,
          {
            _syncId: "custom-public-policy",
            roles: [{ role: null, user: null, sort: null }],
          },
        ],
        roles: [],
      }),
    /Public access must be represented exactly once/,
  );
});

test("rejects array-shaped permission filters", () => {
  assert.throws(
    () =>
      validateDirectusConfig({
        permissions: [{ ...publicPermission, permissions: [] }],
        policies: [publicPolicy],
        roles: [],
      }),
    /Directus expects an object or null/,
  );
});

test("rejects duplicate sync IDs", () => {
  assert.throws(
    () =>
      validateDirectusConfig({
        permissions: [publicPermission, { ...publicPermission }],
        policies: [publicPolicy],
        roles: [],
      }),
    /permissions\.json contains duplicate _syncId public-posts-read/,
  );
});

test("rejects policies that reference an unknown role", () => {
  assert.throws(
    () =>
      validateDirectusConfig({
        permissions: [publicPermission],
        policies: [
          publicPolicy,
          {
            _syncId: "orphan-policy",
            roles: [{ role: "missing-role", user: null, sort: 1 }],
          },
        ],
        roles: [],
      }),
    /Policy orphan-policy references unknown role missing-role/,
  );
});
