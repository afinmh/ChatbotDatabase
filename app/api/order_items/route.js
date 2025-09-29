import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// GET: Fetch order items with pagination and filtering
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

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

    // Check for specific filters
    const orderId = searchParams.get('order_id');
    const productId = searchParams.get('product_id');

    // Build query based on filters
    let query = supabase
      .from('order_items')
      .select(`
        *,
        order:orders!inner(*),
        product:products(name, price)
      `)
      .order('created_at', { ascending: false });

    if (orderId) {
      query = query.eq('order_id', orderId);
    }

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (!orderId && !productId) {
      // If no filters, apply pagination
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error: fetchError, count } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Only return pagination info if no specific filters were applied
    const shouldIncludePagination = !orderId && !productId;
    
    return NextResponse.json({
      data,
      pagination: shouldIncludePagination ? {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      } : undefined
    });
  } catch (error) {
    console.error('Order Items GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new order item
export async function POST(request) {
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

    const body = await request.json();

    // Validate required fields
    if (!body.order_id || !body.product_id || !body.quantity) {
      return NextResponse.json({ 
        error: 'order_id, product_id, and quantity are required' 
      }, { status: 400 });
    }

    // Validate that the order exists
    const { data: order, error: orderCheckError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', body.order_id)
      .single();

    if (orderCheckError || !order) {
      return NextResponse.json({ 
        error: 'Order does not exist' 
      }, { status: 400 });
    }

    // Validate that the product exists
    const { data: product, error: productCheckError } = await supabase
      .from('products')
      .select('id, price')
      .eq('id', body.product_id)
      .single();

    if (productCheckError || !product) {
      return NextResponse.json({ 
        error: 'Product does not exist' 
      }, { status: 400 });
    }

    // Calculate subtotal if not provided
    const calculatedSubtotal = body.subtotal || (body.quantity * product.price);

    // Insert new order item
    const { data, error: insertError } = await supabase
      .from('order_items')
      .insert([{
        order_id: body.order_id,
        product_id: body.product_id,
        quantity: body.quantity,
        subtotal: calculatedSubtotal
      }])
      .select(`
        *,
        product:products(name, price)
      `)
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Order Items POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update an existing order item
export async function PUT(request) {
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

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Get existing order item to validate order and product exist
    const { data: existingItem, error: existingCheckError } = await supabase
      .from('order_items')
      .select('order_id, product_id')
      .eq('id', id)
      .single();

    if (existingCheckError || !existingItem) {
      return NextResponse.json({ error: 'Order item does not exist' }, { status: 404 });
    }

    // Validate if we're updating order_id or product_id that they exist
    if (updateData.order_id) {
      const { data: order, error: orderCheckError } = await supabase
        .from('orders')
        .select('id')
        .eq('id', updateData.order_id)
        .single();

      if (orderCheckError || !order) {
        return NextResponse.json({ error: 'Order does not exist' }, { status: 400 });
      }
    }

    if (updateData.product_id) {
      const { data: product, error: productCheckError } = await supabase
        .from('products')
        .select('id, price')
        .eq('id', updateData.product_id)
        .single();

      if (productCheckError || !product) {
        return NextResponse.json({ error: 'Product does not exist' }, { status: 400 });
      }
    }

    // If updating quantity, recalculate subtotal if needed
    let updateDataWithSubtotal = { ...updateData };
    if (updateData.quantity && !updateData.subtotal) {
      // Get product price to calculate subtotal
      const productId = updateData.product_id || existingItem.product_id;
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('price')
        .eq('id', productId)
        .single();

      if (!productError && product) {
        updateDataWithSubtotal.subtotal = updateData.quantity * product.price;
      }
    }

    // Update order item
    const { data, error: updateError } = await supabase
      .from('order_items')
      .update(updateDataWithSubtotal)
      .eq('id', id)
      .select(`
        *,
        product:products(name, price)
      `)
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Order Items PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete an order item
export async function DELETE(request) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Delete order item
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Order item deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Order Items DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}