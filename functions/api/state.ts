import { getPosState } from "../_lib/pos-database";
import { requireAuth } from "../_lib/auth";

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authOrRes = await requireAuth(context.request, context.env.diapalace_db);
    if (authOrRes instanceof Response) return authOrRes;
    const requestedBranch = new URL(context.request.url).searchParams.get("branchId");
    const branchId = requestedBranch && requestedBranch !== "all" ? requestedBranch : null;
    if (branchId && authOrRes.user.role !== "owner" && !authOrRes.branches.some((branch) => branch.id === branchId)) return Response.json({ error: "You do not have access to this branch." }, { status: 403 });
    return Response.json(await getPosState(context.env.diapalace_db, branchId));
  } catch (error) {
    console.error("Unable to read DiaPalace state from D1", error);
    return Response.json({ error: "Database unavailable" }, { status: 503 });
  }
};
