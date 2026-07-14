import { NextRequest, NextResponse } from "next/server";
import { getExpandedWithholding } from "@/lib/ewt";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const companyId = params.get("companyId");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  if (!companyId || !dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "companyId, dateFrom, and dateTo query parameters are required" },
      { status: 400 }
    );
  }

  const result = await getExpandedWithholding(
    companyId,
    new Date(`${dateFrom}T00:00:00`),
    new Date(`${dateTo}T23:59:59.999`)
  );
  return NextResponse.json(result);
}
