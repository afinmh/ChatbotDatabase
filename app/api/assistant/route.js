import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Lightweight assistant endpoint for admin UI.
// POST: { message: string }
// Auth: Bearer <access_token> (validated via Supabase auth.getUser)
// Behavior: If OPENAI_API_KEY present, proxy to OpenAI Chat Completion API.
// Otherwise return a canned fallback assistant reply.

async function proxyToOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are Si-Mbah assistant — helpful, concise, and specific to an Indonesian herbal shop admin.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI proxy error:', res.status, err);
      return null;
    }

    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content || null;
    return text;
  } catch (err) {
    console.error('OpenAI proxy exception:', err);
    return null;
  }
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const message = (body && body.message) ? String(body.message).trim() : '';

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Try proxying to OpenAI if available
    const openaiReply = await proxyToOpenAI(message);
    if (openaiReply) {
      return NextResponse.json({ reply: openaiReply }, { status: 200 });
    }

    // Fallback canned assistant behavior (non-RAG)
    const fallback = `Halo, saya Asisten Si-Mbah. Anda bertanya: "${message}". Untuk fitur ini, saya dapat membantu dengan petunjuk umum (mis. cara menambah produk, melihat pesanan). Jika anda ingin jawaban yang lebih lengkap atau berdasar data, hubungkan proyek dengan layanan AI (SET OPENAI_API_KEY).`;

    return NextResponse.json({ reply: fallback }, { status: 200 });
  } catch (err) {
    console.error('Assistant POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
