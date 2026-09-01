import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/api-auth";
import { ok, err } from "@/lib/api-response";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_SIZE_MB = 10;

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return err("Invalid form data", 400);
  }

  const file = formData.get("file") as File | null;
  if (!file) return err("No file provided", 400);

  if (!ALLOWED_TYPES.includes(file.type)) {
    return err(`Unsupported file type: ${file.type}. Allowed: jpg, png, webp, gif, avif`, 400);
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return err(`File too large. Max ${MAX_SIZE_MB}MB`, 400);
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const filename = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from("insights-images")
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    // Bucket might not exist yet — surface a clear message
    if (uploadError.message.includes("Bucket not found") || uploadError.message.includes("bucket")) {
      return err(
        'Storage bucket "insights-images" not found. Create it in your Supabase dashboard (Storage → New bucket → "insights-images", Public).',
        500
      );
    }
    return err(uploadError.message, 500);
  }

  const { data } = supabaseAdmin.storage
    .from("insights-images")
    .getPublicUrl(filename);

  return ok({ url: data.publicUrl });
}
