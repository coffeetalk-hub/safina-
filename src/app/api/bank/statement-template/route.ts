import { NextRequest } from "next/server";
import { getSession, can } from "@/core/auth/session";
import { statementTemplate } from "@/modules/finance/bank/service";
import { excelResponse } from "@/core/export/excel";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!can(session, "finance.reconciliation:view")) return new Response("Forbidden", { status: 403 });
  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "ar";
  return excelResponse(await statementTemplate(locale), "bank-statement-template");
}
