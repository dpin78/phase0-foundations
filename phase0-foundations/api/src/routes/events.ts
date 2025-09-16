import { Router } from "express";
import { z } from "zod";

const router = Router();

const listQuery = z.object({
  device_id: z.string().uuid().optional(),
  type: z.string().optional(),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100)
});

router.get("/", async (req, res) => {
  try {
    const q = listQuery.parse(req.query);
    const supabase = (req as any).supabase;
    let query = supabase.from("events").select("*").order("occurred_at", { ascending: false }).limit(q.limit);
    if (q.device_id) query = query.eq("device_id", q.device_id);
    if (q.type) query = query.eq("event_type", q.type);
    if (q.since) query = query.gte("occurred_at", q.since);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (e:any) {
    res.status(400).json({ error: e.message || e });
  }
});

const postBody = z.object({
  owner_id: z.string().uuid(),
  device_id: z.string().uuid(),
  occurred_at: z.string().datetime().optional(),
  event_type: z.string(),
  payload: z.record(z.any())
});

router.post("/", async (req, res) => {
  try {
    const body = postBody.parse(req.body);
    const supabase = (req as any).supabase;
    const { data, error } = await supabase.from("events").insert({
      owner_id: body.owner_id,
      device_id: body.device_id,
      occurred_at: body.occurred_at || new Date().toISOString(),
      event_type: body.event_type,
      payload: body.payload
    }).select("*").single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e:any) {
    res.status(400).json({ error: e.message || e });
  }
});

export default router;