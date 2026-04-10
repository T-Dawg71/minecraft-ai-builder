import { NextRequest } from "next/server";

import { applyExportRateLimit, proxyExportRequest } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimitedResponse = applyExportRateLimit(request);
  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  return proxyExportRequest(request, "/export/block-list");
}
