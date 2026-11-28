/**
 * k6 — Supabase Realtime websocket fan-out (LOCAL / STAGING only).
 *
 * Opens N websocket connections subscribed to postgres_changes on stock_levels
 * and measures subscribe success + optional broadcast latency.
 *
 * Env:
 *   K6_SUPABASE_URL
 *   K6_SUPABASE_ANON_KEY
 *   K6_TEST_EMAIL
 *   K6_TEST_PASSWORD
 *   K6_REALTIME_VUS   (50|100|200|500)
 *   K6_VENUE_ID
 */
import { check, fail, sleep } from "k6";
import http from "k6/http";
import ws from "k6/ws";
import { Counter, Rate, Trend } from "k6/metrics";

const connectOk = new Rate("realtime_connect_ok");
const msgLatency = new Trend("realtime_msg_latency_ms", true);
const drops = new Counter("realtime_drops");

const vus = Number(__ENV.K6_REALTIME_VUS || 50);

export const options = {
  vus,
  duration: "2m",
  thresholds: {
    realtime_connect_ok: ["rate>0.99"],
    realtime_msg_latency_ms: ["p(95)<500"],
  },
};

function cfg() {
  const httpBase = (__ENV.K6_SUPABASE_URL || "").replace(/\/$/, "");
  const key = __ENV.K6_SUPABASE_ANON_KEY;
  const email = __ENV.K6_TEST_EMAIL;
  const password = __ENV.K6_TEST_PASSWORD;
  if (!httpBase || !key || !email || !password) fail("Missing Realtime env");
  const wsBase = httpBase.replace(/^http/, "ws") + "/realtime/v1/websocket";
  return { httpBase, wsBase, key, email, password, venueId: __ENV.K6_VENUE_ID || "" };
}

export function setup() {
  const c = cfg();
  const login = http.post(
    `${c.httpBase}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: c.email, password: c.password }),
    { headers: { apikey: c.key, "Content-Type": "application/json" } },
  );
  if (login.status !== 200) fail(`auth ${login.status}`);
  return { ...c, token: login.json().access_token };
}

export default function (data) {
  const url = `${data.wsBase}?apikey=${data.key}&vsn=1.0.0`;
  const jarStart = Date.now();
  let joined = false;

  const res = ws.connect(url, { headers: { Authorization: `Bearer ${data.token}` } }, function (socket) {
    socket.on("open", () => {
      const topic = data.venueId
        ? `realtime:public:stock_levels:venue_id=eq.${data.venueId}`
        : "realtime:public:stock_levels";
      socket.send(JSON.stringify({
        topic,
        event: "phx_join",
        payload: {
          config: {
            postgres_changes: [{
              event: "*",
              schema: "public",
              table: "stock_levels",
              filter: data.venueId ? `venue_id=eq.${data.venueId}` : undefined,
            }],
          },
        },
        ref: "1",
      }));
    });

    socket.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.event === "phx_reply" && msg.ref === "1") {
        joined = msg.payload?.status === "ok";
        connectOk.add(joined);
        msgLatency.add(Date.now() - jarStart);
      }
      if (msg.event === "postgres_changes") {
        msgLatency.add(Date.now() - jarStart);
      }
    });

    socket.on("close", () => {
      if (!joined) {
        connectOk.add(false);
        drops.add(1);
      }
    });

    socket.on("error", () => {
      connectOk.add(false);
      drops.add(1);
    });

    socket.setTimeout(() => socket.close(), 90_000);
  });

  check(res, { "ws status 101": (r) => r && r.status === 101 });
  sleep(1);
}
