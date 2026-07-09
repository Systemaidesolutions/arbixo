import { NextRequest } from "next/server";
import { saveSalesDoc } from "@/lib/salesDocHandler";

export async function POST(request: NextRequest) {
  return saveSalesDoc(request, null);
}
