import { NextRequest } from "next/server";
import { handleImportationImport } from "@/lib/importationImport";

export async function POST(request: NextRequest) {
  return handleImportationImport(request);
}
