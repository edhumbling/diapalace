import { requireAuth, logAudit } from "../_lib/auth";

const PROFILE_FIELDS = [
  "name", "trading_name", "description", "logo_data", "store_type",
  "phone", "alt_phone", "whatsapp", "email", "website",
  "country", "region", "city", "digital_address", "physical_address", "gps_location",
  "registration_number", "tax_number", "currency", "default_language",
  "business_hours", "receipt_footer", "return_policy",
] as const;

const MAX_LOGO_BYTES = 300 * 1024;

function sanitizeProfile(payload: Record<string, unknown>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const field of PROFILE_FIELDS) {
    const raw = payload[field];
    if (raw === undefined) continue;
    if (field === "logo_data" && typeof raw === "string") {
      if (raw === "") {
        clean[field] = "";
        continue;
      }
      if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(raw)) {
        throw new Error("INVALID_LOGO");
      }
      if (Buffer.byteLength(raw, "utf8") > MAX_LOGO_BYTES) {
        throw new Error("LOGO_TOO_LARGE");
      }
      clean[field] = raw;
      continue;
    }
    clean[field] = typeof raw === "string" ? raw.trim() : "";
  }
  if ("name" in clean && !clean.name) {
    throw new Error("NAME_REQUIRED");
  }
  return clean;
}

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    const db = context.env.diapalace_db;
    const business = await db
      .prepare(
        `SELECT id, name, trading_name, description, logo_data, store_type, phone, alt_phone,
                whatsapp, email, website, country, region, city, digital_address, physical_address,
                gps_location, registration_number, tax_number, currency, default_language,
                business_hours, receipt_footer, return_policy, created_at, updated_at
         FROM businesses WHERE id = ?`
      )
      .bind(authOrRes.user.business_id)
      .first<Record<string, string | null>>();

    if (!business) {
      return Response.json({ error: "Business not found." }, { status: 404 });
    }

    const customFields = await db
      .prepare(
        `SELECT id, field_name, field_value, sort_order
         FROM store_custom_fields
         WHERE business_id = ?
         ORDER BY sort_order, created_at`
      )
      .bind(authOrRes.user.business_id)
      .all<{ id: string; field_name: string; field_value: string; sort_order: number }>();

    return Response.json({
      success: true,
      business: { ...business, logo_data: business.logo_data || null },
      customFields: customFields.results ?? [],
    });
  } catch (error) {
    console.error("Get store profile error:", error);
    return Response.json({ error: "Failed to load store profile" }, { status: 500 });
  }
};

export const onRequestPut: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;

    if (authOrRes.user.role !== "owner") {
      return Response.json({ error: "Only the business owner can edit the store profile." }, { status: 403 });
    }

    const db = context.env.diapalace_db;
    const body = await context.request.json() as {
      business?: Record<string, unknown>;
      customFields?: Array<{ id?: string; field_name: string; field_value: string; sort_order?: number }>;
    };

    let clean: Record<string, string>;
    try {
      clean = sanitizeProfile(body.business || {});
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "INVALID_LOGO") {
        return Response.json({ error: "The logo must be a PNG, JPEG, WebP or GIF image. No changes were made." }, { status: 400 });
      }
      if (message === "LOGO_TOO_LARGE") {
        return Response.json({ error: "The logo is too large. Use an image under 300 KB. No changes were made." }, { status: 400 });
      }
      return Response.json({ error: "The store name is required. No changes were made." }, { status: 400 });
    }

    const existing = await db
      .prepare("SELECT name, phone, email, receipt_footer, logo_data FROM businesses WHERE id = ?")
      .bind(authOrRes.user.business_id)
      .first<Record<string, string | null>>();
    if (!existing) {
      return Response.json({ error: "Business not found. No changes were made." }, { status: 404 });
    }

    const previous = {
      name: existing.name,
      phone: existing.phone || "",
      email: existing.email || "",
      receipt_footer: existing.receipt_footer || "",
      has_logo: Boolean(existing.logo_data),
    };

    const setColumns = PROFILE_FIELDS.filter((field) => field in clean);
    const sql = `UPDATE businesses SET ${setColumns.map((field) => `${field} = ?`).join(", ")}, updated_at = ? WHERE id = ?`;
    const values = [...setColumns.map((field) => clean[field]), new Date().toISOString(), authOrRes.user.business_id];
    await db.prepare(sql).bind(...values).run();

    const submittedFields = body.customFields || [];
    if (submittedFields.length > 0) {
      const operations: D1PreparedStatement[] = [
        db.prepare("DELETE FROM store_custom_fields WHERE business_id = ?").bind(authOrRes.user.business_id),
      ];
      for (const [index, field] of submittedFields.entries()) {
        const fieldName = field.field_name?.trim();
        if (!fieldName) continue;
        operations.push(
          db.prepare(
            `INSERT INTO store_custom_fields (id, business_id, field_name, field_value, sort_order, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            field.id || `scf-${crypto.randomUUID()}`,
            authOrRes.user.business_id,
            fieldName,
            field.field_value?.trim() ?? "",
            typeof field.sort_order === "number" ? field.sort_order : index,
            new Date().toISOString()
          )
        );
      }
      if (operations.length > 1) {
        await db.batch(operations);
      }
    }

    await logAudit(db, {
      business_id: authOrRes.user.business_id,
      user_id: authOrRes.user.id,
      user_name: authOrRes.user.full_name,
      branch_id: "",
      module: "SETTINGS",
      action: "STORE_PROFILE_UPDATED",
      entity_type: "BUSINESS",
      entity_id: authOrRes.user.business_id,
      old_values: previous,
      new_values: {
        name: clean.name ?? previous.name,
        phone: clean.phone ?? previous.phone,
        email: clean.email ?? previous.email,
        receipt_footer: clean.receipt_footer ?? previous.receipt_footer,
        has_logo: "logo_data" in clean ? Boolean(clean.logo_data) : previous.has_logo,
        custom_fields_count: submittedFields.length,
      },
      reason: `Store profile updated by Owner ${authOrRes.user.full_name}`,
      description: `STORE_PROFILE_UPDATED: business profile updated by Owner ${authOrRes.user.full_name}`,
    });

    return Response.json({
      success: true,
      message: "Store profile saved. It is now used across receipts and POS screens.",
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Update store profile error:", error);
    return Response.json({ error: "Failed to save store profile. No changes were made." }, { status: 500 });
  }
};
