import { validateSession } from "../../_lib/auth";

export const onRequestGet: PagesFunction<CloudflareEnv> = async (context) => {
  try {
    const authHeader = context.request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : context.request.headers.get("X-Session-Token");

    if (!token) {
      return Response.json({ authenticated: false });
    }

    const session = await validateSession(context.env.diapalace_db, token);
    if (!session) {
      return Response.json({ authenticated: false });
    }

    return Response.json({
      authenticated: true,
      user: session.user,
      business: session.business,
      branches: session.branches,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return Response.json({ authenticated: false });
  }
};
