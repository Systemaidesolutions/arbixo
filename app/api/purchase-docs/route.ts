import { NextRequest } from "next/server";
import { savePurchaseDoc } from "@/lib/purchaseDocHandler";

export async function POST(request: NextRequest) {
  return savePurchaseDoc(request, null);
}
