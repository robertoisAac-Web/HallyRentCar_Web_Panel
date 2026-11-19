import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: authData } = await sb.auth.getUser();
    if (!authData?.user) {
      return NextResponse.json({ reservations: [] }, { status: 401 });
    }

    const { data: membership } = await sb
      .from("memberships")
      .select("company_id, role, is_active")
      .eq("user_id", authData.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!membership?.company_id) {
      return NextResponse.json({ reservations: [] }, { status: 403 });
    }

    const { data: rows, error } = await sb
      .from("reservations")
      .select(
        "id, code, status, channel, pickup_at, return_at, pickup_location, return_location, total_amount, currency, created_at, customer:customers(full_name, phone), vehicle:vehicles(make, model, year, plate)"
      )
      .eq("company_id", membership.company_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ reservations: [] }, { status: 500 });
    }

    return NextResponse.json({
      reservations: rows ?? [],
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ reservations: [] }, { status: 500 });
  }
}
