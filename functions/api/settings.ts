export const onRequestPut: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const body = await context.request.json() as { taxEnabled?: boolean; taxRate?: number };
    if (typeof body.taxEnabled !== "boolean" || typeof body.taxRate !== "number") return Response.json({ error: "Invalid settings" }, { status: 400 });
    await context.env.diapalace_db.batch([
      context.env.diapalace_db.prepare("INSERT INTO settings (key, value) VALUES ('tax_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(body.taxEnabled ? "1" : "0"),
      context.env.diapalace_db.prepare("INSERT INTO settings (key, value) VALUES ('tax_rate', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(body.taxRate)),
    ]);
    return Response.json({ saved: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unable to save settings" }, { status: 500 });
  }
};
