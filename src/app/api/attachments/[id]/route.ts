import { NextRequest } from "next/server";
import { getSession } from "@/core/auth/session";
import { getAttachment } from "@/modules/foundation/attachments/service";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  try {
    const { meta, data } = await getAttachment(session, id);
    const inline = meta.mimeType.startsWith("image/") || meta.mimeType === "application/pdf";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Length": String(meta.size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
