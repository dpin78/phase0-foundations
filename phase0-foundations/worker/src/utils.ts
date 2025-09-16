import { z } from "zod";

export const topicSchema = z.tuple([
  z.string(), // env
  z.string(), // owner
  z.string(), // location
  z.string(), // device
  z.string()  // channel (evt)
]);

export function parseTopic(topic: string) {
  const parts = topic.replace(/^\//, "").split("/");
  const parsed = topicSchema.safeParse(parts);
  if (!parsed.success) throw new Error("Invalid topic: " + topic);
  const [env, owner, location, device, channel] = parsed.data;
  return { env, owner, location, device, channel };
}