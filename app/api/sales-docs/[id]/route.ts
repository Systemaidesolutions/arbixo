import { NextRequest } from "next/server";
import { saveSalesDoc } from "@/lib/salesDocHandler";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return saveSalesDoc(request, params.id);
}
