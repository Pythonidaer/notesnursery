import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OCR_MAX_BYTES = 1_024 * 1_024; // OCR.space free tier limit
const OCR_URL = "https://api.ocr.space/parse/image";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function getFilenameForMime(mime: string) {
  const m = (mime || "image/jpeg").toLowerCase();
  if (m.includes("png")) return "upload.png";
  if (m.includes("webp")) return "upload.webp";
  if (m.includes("gif")) return "upload.gif";
  if (m.includes("jpeg") || m.includes("jpg")) return "upload.jpg";
  return "upload";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const b64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
  if (!b64) {
    return json({ error: "imageBase64 is required" }, 400);
  }
  if (b64.length > 3_000_000) {
    return json({ error: "Image payload too large" }, 400);
  }

  const apiKey = Deno.env.get("OCR_SPACE_API_KEY")?.trim();
  if (!apiKey) {
    console.error("ocr-image-to-text: OCR_SPACE_API_KEY is not set");
    return json({ error: "OCR is not configured" }, 503);
  }

  let bytes: Uint8Array;
  try {
    bytes = bytesFromBase64(b64);
  } catch {
    return json({ error: "Invalid base64 image" }, 400);
  }
  if (bytes.byteLength < 8) {
    return json({ error: "Image file is too small" }, 400);
  }
  if (bytes.byteLength > OCR_MAX_BYTES) {
    return json({ error: "Image file must be 1MB or smaller (OCR limit)" }, 400);
  }

  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "image/jpeg";
  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", "eng");
  form.append("OCREngine", "2");
  form.append("file", new Blob([bytes], { type: mimeType }), getFilenameForMime(mimeType));

  const ocrRes = await fetch(OCR_URL, { method: "POST", body: form });
  if (!ocrRes.ok) {
    const t = await ocrRes.text();
    console.error("ocr-image-to-text: OCR.space HTTP", ocrRes.status, t.slice(0, 500));
    return json({ error: "OCR service request failed" }, 502);
  }

  const data = (await ocrRes.json()) as {
    OCRExitCode?: number;
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[] | null;
    ParsedResults?: { ParsedText?: string }[] | null;
  };

  if (data.IsErroredOnProcessing) {
    const em = data.ErrorMessage;
    const errStr = Array.isArray(em) ? em.join("; ") : (em ?? "OCR failed");
    console.error("ocr-image-to-text: OCRError", errStr);
    return json({ error: errStr }, 400);
  }

  const parts = (data.ParsedResults ?? [])
    .map((r) => (typeof r?.ParsedText === "string" ? r.ParsedText : ""))
    .map((s) => s.trim())
    .filter(Boolean);
  const text = parts.join("\n\n").trim();

  if (!text) {
    return json({ error: "No text was recognized in that image" }, 400);
  }

  return json({ text });
});
