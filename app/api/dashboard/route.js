import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request) {
  // Check if user is authenticated by verifying the presence of session
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    // Verify token is valid
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get dashboard statistics based on schema
    const { count: totalMembers, error: membersError } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true });

    const { count: totalProducts, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: totalOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (membersError || productsError || ordersError) {
      return NextResponse.json({ error: 'Error fetching statistics' }, { status: 500 });
    }

    // Get recent activities (last 5 items)
    const { data: recentMembers, error: recentMembersError } = await supabase
      .from('members')
      .select('name, created_at')
      .order('created_at', { ascending: false })
      .limit(2);

    const { data: recentProducts, error: recentProductsError } = await supabase
      .from('products')
      .select('name, created_at')
      .order('created_at', { ascending: false })
      .limit(2);

    let recentActivities = [];

    if (!recentMembersError && recentMembers) {
      recentActivities = recentActivities.concat(
        recentMembers.map(item => ({
          type: 'member',
          text: `Member baru: ${item.name}`,
          time: new Date(item.created_at).toLocaleString('id-ID'),
          icon: 'user-plus'
        }))
      );
    }

    if (!recentProductsError && recentProducts) {
      recentActivities = recentActivities.concat(
        recentProducts.map(item => ({
          type: 'product',
          text: `Produk baru: ${item.name}`,
          time: new Date(item.created_at).toLocaleString('id-ID'),
          icon: 'shopping-bag'
        }))
      );
    }

    // Sort activities by date, get latest 5
    recentActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
    recentActivities = recentActivities.slice(0, 5);

    return NextResponse.json({
      stats: {
        totalMembers: totalMembers || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0
      },
      recentActivities
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}