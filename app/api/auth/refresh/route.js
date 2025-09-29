import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let refresh_token = null;

    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      refresh_token = body.refresh_token || null;
    }

    // Fallback: allow passing refresh token via Authorization header as "Bearer <refresh_token>"
    if (!refresh_token) {
      const auth = request.headers.get('authorization');
      if (auth && auth.startsWith('Bearer ')) {
        refresh_token = auth.split(' ')[1];
      }
    }

    if (!refresh_token) {
      return NextResponse.json({ error: 'No refresh token provided' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error || !data?.session) {
      return NextResponse.json({ error: error?.message || 'Failed to refresh session' }, { status: 401 });
    }

    // Return the refreshed session (contains new access_token and refresh_token)
    return NextResponse.json({ session: data.session }, { status: 200 });
  } catch (err) {
    console.error('Refresh token error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
