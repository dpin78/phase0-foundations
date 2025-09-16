import { Router } from "express";
import { z } from "zod";

const router = Router();
const patchBody = z.object({
  settings: z.record(z.any())
});

router.patch("/:id/settings", async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { settings } = patchBody.parse(req.body);
    const supabase = (req as any).supabase;

    // Store as jsonb in a device_settings table (create if missing)
    const { error } = await supabase.rpc("upsert_device_settings", {
      p_device_id: id,
      p_settings: settings
    });
    if (error) throw error;

    res.json({ ok: true });
  } catch (e:any) {
    res.status(400).json({ error: e.message || e });
  }
});

export default router;