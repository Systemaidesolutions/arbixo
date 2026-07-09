import { NextRequest } from "next/server";
import { savePurchaseDoc } from "@/lib/purchaseDocHandler";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return savePurchaseDoc(request, params.id);
}
