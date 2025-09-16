import 'dotenv/config';
import mqtt from "mqtt";
import { createClient } from "@supabase/supabase-js";
import { parseTopic } from "./utils.js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MQTT_URL = process.env.MQTT_URL!;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_TOPIC = process.env.MQTT_TOPIC || "/dev/+/+/+/evt";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase env vars.");
}
if (!MQTT_URL) {
  throw new Error("Missing MQTT_URL.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

console.log("[worker] connecting mqtt", MQTT_URL);
const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD
});

client.on("connect", () => {
  console.log("[worker] mqtt connected");
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error("[worker] subscribe error:", err);
    else console.log("[worker] subscribed:", MQTT_TOPIC);
  });
});

client.on("message", async (topic, payloadBuf) => {
  const payloadStr = payloadBuf.toString();
  try {
    const { env, owner, location, device, channel } = parseTopic(topic);
    const payload = JSON.parse(payloadStr);
    const occurred_at = payload.occurred_at || new Date().toISOString();
    const event_type = payload.event_type || "unknown";

    // insert event
    const { error: evtErr } = await supabase
      .from("events")
      .insert({
        owner_id: owner,
        device_id: device,
        occurred_at,
        event_type,
        payload
      });

    if (evtErr) throw evtErr;

    // upsert device_health (optional fields)
    const { error: healthErr } = await supabase
      .from("device_health")
      .upsert({
        device_id: device,
        owner_id: owner,
        battery: payload.battery ?? null,
        rssi: payload.rssi ?? null,
        temp_c: payload.temp_c ?? null,
        updated_at: new Date().toISOString()
      });

    if (healthErr) throw healthErr;

    console.log("[worker] ok:", { topic, event_type });
  } catch (e:any) {
    console.error("[worker] failed:", e?.message || e, "topic=", topic, "payload=", payloadStr);
    // TODO: insert into events_deadletter table if desired
  }
});

client.on("error", (e) => console.error("[worker] mqtt error:", e));