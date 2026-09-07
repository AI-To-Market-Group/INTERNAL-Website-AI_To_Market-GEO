import { requireUser } from "@/lib/api-auth";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  return Response.json({ id: user.id, email: user.email });
}
