import { check, sleep } from "k6";
import { b64encode } from "k6/encoding";
import http from "k6/http";

const reads = ["/dashboard", "/ingredients", "/recipes"];

export const options = {
  maxRedirects: 0,
  discardResponseBodies: true,
  scenarios: {
    dashboard_reads: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5m", target: 200 },
        { duration: "5m", target: 500 },
      ],
      gracefulStop: "0s",
    },
  },
  thresholds: {
    "http_req_duration{operation:read}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const expectOk = http.expectedStatuses(200);

function stagingConfig() {
  const origin = (__ENV.K6_STAGING_ORIGIN ?? "").replace(/\/$/, "");
  const project = __ENV.K6_STAGING_PROJECT_REF ?? "";
  const key = __ENV.K6_STAGING_ANON_KEY;
  const email = __ENV.K6_STAGING_EMAIL;
  const password = __ENV.K6_STAGING_PASSWORD;
  if (!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(origin) ||
      !/^[a-z0-9]{20}$/.test(project) || !key || !email || !password) {
    throw new Error("Set the staging HTTPS origin, Supabase project ref, public key and test account.");
  }
  return { origin, project, key, email, password };
}

function sessionCookies(project, session) {
  // Match the installed Supabase SSR storage key and its base64url chunks.
  const key = `sb-${project}-auth-token`;
  const value = "base64-" + b64encode(JSON.stringify(session), "rawurl");
  if (value.length <= 3180) return { [key]: value };
  return Object.fromEntries(value.match(/.{1,3180}/g).map((chunk, index) => [`${key}.${index}`, chunk]));
}

export function setup() {
  const { origin, project, key, email, password } = stagingConfig();
  const probe = http.get(origin + "/login", {
    redirects: 0,
    headers: { Accept: "text/html" },
    tags: { operation: "preflight", name: "staging preflight" },
    responseCallback: expectOk,
  });
  if (probe.status !== 200 ||
      probe.headers["X-Treuplate-Environment"] !== "staging" ||
      probe.headers["X-Treuplate-Supabase-Project"] !== project) {
    throw new Error("The deployment did not confirm the configured staging project.");
  }

  // Authenticate once so read traffic is independent of Auth login rate limits.
  const login = http.post(`https://${project}.supabase.co/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }), {
      redirects: 0,
      headers: { apikey: key, "Content-Type": "application/json" },
      tags: { operation: "auth", name: "staging test sign-in" },
      responseType: "text",
      responseCallback: expectOk,
    });
  if (!check(login, { "test account signed in": (response) => response.status === 200 })) {
    throw new Error("Staging test sign-in failed.");
  }
  const session = login.json();
  if (typeof session.access_token !== "string" || typeof session.refresh_token !== "string" ||
      Number(session.expires_in) < 660 || !session.user?.id) {
    throw new Error("The staging session must remain valid throughout the 10-minute run.");
  }
  session.expires_at ??= Math.floor(Date.now() / 1000) + Number(session.expires_in);

  const cookies = sessionCookies(project, session);
  const authenticated = http.get(origin + "/dashboard", {
    cookies, redirects: 0, headers: { Accept: "text/html" },
    tags: { operation: "preflight", name: "authenticated dashboard preflight" },
    responseCallback: expectOk,
  });
  if (authenticated.status !== 200) throw new Error("Staging did not accept the test session.");
  return { origin, cookies };
}

export default function ({ origin, cookies }) {
  for (const path of reads) {
    const response = http.get(origin + path, {
      cookies,
      redirects: 0,
      headers: { Accept: "text/html" },
      tags: { operation: "read", name: path },
      responseCallback: expectOk,
    });
    check(response, { "authenticated read returned 200": (result) => result.status === 200 });
  }
  sleep(1);
}
