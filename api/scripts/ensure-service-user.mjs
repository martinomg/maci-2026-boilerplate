import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(apiRoot, ".env") });

const SERVICE_EMAIL = "app-service@example.com";
const SERVICE_ROLE_NAME = "Internal User";

const baseUrl = process.env.DIRECTUS_PUBLIC_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;

if (!baseUrl || !adminEmail || !adminPassword) {
  console.error("ensure-service-user: DIRECTUS_PUBLIC_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

if (!serviceToken || serviceToken === "change-me-service-token") {
  console.log("ensure-service-user: DIRECTUS_SERVICE_TOKEN is unset; skipping service-user provisioning.");
  process.exit(0);
}

async function request(pathname, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) {
    throw new Error(`${method} ${pathname} failed (${response.status}): ${JSON.stringify(payload.errors ?? payload)}`);
  }
  return payload.data;
}

const auth = await request("/auth/login", {
  method: "POST",
  body: { email: adminEmail, password: adminPassword },
});
const adminToken = auth.access_token;

const roles = await request(
  `/roles?filter[name][_eq]=${encodeURIComponent(SERVICE_ROLE_NAME)}&fields=id,name`,
  { token: adminToken },
);
if (roles.length === 0) {
  console.log(`ensure-service-user: role "${SERVICE_ROLE_NAME}" not found yet; skipping.`);
  process.exit(0);
}
const roleId = roles[0].id;

const users = await request(
  `/users?filter[email][_eq]=${encodeURIComponent(SERVICE_EMAIL)}&fields=id,role,token`,
  { token: adminToken },
);

if (users.length === 0) {
  await request("/users", {
    method: "POST",
    token: adminToken,
    body: {
      email: SERVICE_EMAIL,
      role: roleId,
      token: serviceToken,
      status: "active",
      first_name: "App",
      last_name: "Service",
    },
  });
  console.log(`ensure-service-user: created ${SERVICE_EMAIL} with role "${SERVICE_ROLE_NAME}".`);
} else {
  await request(`/users/${users[0].id}`, {
    method: "PATCH",
    token: adminToken,
    body: { role: roleId, token: serviceToken, status: "active" },
  });
  console.log(`ensure-service-user: ensured ${SERVICE_EMAIL} role and token are current.`);
}
