import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(apiRoot, ".env") });

/**
 * Service users the application authenticates as. Each one owns a static token
 * so the Next.js server can act with exactly one Directus role and let Directus
 * enforce the permissions instead of trusting the application layer.
 */
const SERVICE_USERS = [
  {
    email: "app-service@example.com",
    roleName: "Internal User",
    firstName: "App",
    lastName: "Service",
    tokenVariable: "DIRECTUS_SERVICE_TOKEN",
    placeholder: "change-me-service-token",
  },
  {
    email: "configurator-service@example.com",
    roleName: "Configurator",
    firstName: "Configurator",
    lastName: "Service",
    tokenVariable: "DIRECTUS_CONFIGURATOR_TOKEN",
    placeholder: "change-me-configurator-token",
  },
];

const baseUrl = process.env.DIRECTUS_PUBLIC_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!baseUrl || !adminEmail || !adminPassword) {
  console.error("ensure-service-user: DIRECTUS_PUBLIC_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

const configured = SERVICE_USERS.filter((serviceUser) => {
  const token = process.env[serviceUser.tokenVariable];
  if (!token || token === serviceUser.placeholder) {
    console.log(
      `ensure-service-user: ${serviceUser.tokenVariable} is unset; skipping ${serviceUser.email}.`,
    );
    return false;
  }
  return true;
});

if (configured.length === 0) {
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

for (const serviceUser of configured) {
  const serviceToken = process.env[serviceUser.tokenVariable];

  const roles = await request(
    `/roles?filter[name][_eq]=${encodeURIComponent(serviceUser.roleName)}&fields=id,name`,
    { token: adminToken },
  );
  if (roles.length === 0) {
    console.log(`ensure-service-user: role "${serviceUser.roleName}" not found yet; skipping.`);
    continue;
  }
  const roleId = roles[0].id;

  const users = await request(
    `/users?filter[email][_eq]=${encodeURIComponent(serviceUser.email)}&fields=id,role,token`,
    { token: adminToken },
  );

  if (users.length === 0) {
    await request("/users", {
      method: "POST",
      token: adminToken,
      body: {
        email: serviceUser.email,
        role: roleId,
        token: serviceToken,
        status: "active",
        first_name: serviceUser.firstName,
        last_name: serviceUser.lastName,
      },
    });
    console.log(`ensure-service-user: created ${serviceUser.email} with role "${serviceUser.roleName}".`);
  } else {
    await request(`/users/${users[0].id}`, {
      method: "PATCH",
      token: adminToken,
      body: { role: roleId, token: serviceToken, status: "active" },
    });
    console.log(`ensure-service-user: ensured ${serviceUser.email} role and token are current.`);
  }
}
