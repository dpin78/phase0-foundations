import { Router } from "express";
import { z } from "zod";

const router = Router();
const paramsSchema = z.object({ id: z.string().uuid("device id must be uuid") });

router.get("/:id", async (req, res) => {
  try {
    const { id } = paramsSchema.parse(req.params);
    const supabase = (req as any).supabase;

    // Join device + device_health
    const { data, error } = await supabase
      .from("devices")
      .select("*, device_health(*)")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "device not found" });
    res.json(data);
  } catch (e:any) {
    res.status(400).json({ error: e.message || e });
  }
});

export default router;