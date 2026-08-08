import { hashPin, requireAuth } from "../../_lib/auth";

export const onRequestPost: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const body = await context.request.json() as { pin?: string; setPin?: boolean };
    if (!body.pin || body.pin.length < 4) {
      return Response.json({ error: "A 4-digit PIN is required." }, { status: 400 });
    }

    const db = context.env.diapalace_db;
    const pinHash = await hashPin(body.pin);

    // If user has no PIN or setPin is true, save PIN
    if (body.setPin || !authOrRes.user.pin_hash) {
      await db.prepare("UPDATE users SET pin_hash = ? WHERE id = ?").bind(pinHash, authOrRes.user.id).run();
      return Response.json({ success: true, message: "PIN set successfully." });
    }

    // Verify PIN
    if (authOrRes.user.pin_hash === pinHash) {
      return Response.json({ valid: true });
    }

    return Response.json({ error: "Incorrect PIN." }, { status: 401 });
  } catch (error) {
    console.error("PIN verification error:", error);
    return Response.json({ error: "PIN operation failed" }, { status: 500 });
  }
};
