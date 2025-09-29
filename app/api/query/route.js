import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib';

// ---- Helpers ----
function safeJSON(x) {
  if (!x) return {};
  if (typeof x === "object") return x;
  try {
    return JSON.parse(x);
  } catch {
    return {};
  }
}

async function fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Rate limit reached. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
        continue; // retry
      }
      return response;
    } catch (error) {
      console.error("💥 Network error during fetch:", error);
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
  throw new Error(`Failed to fetch from ${url} after ${maxRetries} attempts.`);
}

// Supabase service-role client (use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
let sbClient;
function getSupabase() {
  if (sbClient) return sbClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
  sbClient = createClient(url, key, { auth: { persistSession: false } });
  return sbClient;
}

// Validate generated SQL: allow only SELECT queries and only allowed tables
const ALLOWED_TABLES = ['members', 'products', 'orders', 'order_items'];
function extractTableNames(sql) {
  const names = new Set();
  const lowered = sql.replace(/\n/g, ' ');
  const fromRegex = /from\s+([^\s,;()]+)/gi;
  const joinRegex = /join\s+([^\s,;()]+)/gi;
  let m;
  while ((m = fromRegex.exec(lowered)) !== null) {
    let tbl = m[1].trim();
    if (tbl.startsWith('(')) continue; // subquery
    // remove schema prefix and quotes
    tbl = tbl.replace(/^"|"$/g, '');
    if (tbl.includes('.')) tbl = tbl.split('.').pop();
    names.add(tbl.replace(/"/g, ''));
  }
  while ((m = joinRegex.exec(lowered)) !== null) {
    let tbl = m[1].trim();
    if (tbl.startsWith('(')) continue;
    tbl = tbl.replace(/^"|"$/g, '');
    if (tbl.includes('.')) tbl = tbl.split('.').pop();
    names.add(tbl.replace(/"/g, ''));
  }
  return Array.from(names);
}

function validateSQL(sql) {
  const raw = sql.trim();
  const lowered = raw.toLowerCase();
  // Disallow dangerous statements anywhere
  const forbidden = ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', 'grant ', 'revoke ', 'create ', 'copy ', ';\s*--'];
  for (const f of forbidden) {
    if (lowered.includes(f)) return { ok: false, reason: `Forbidden keyword detected: ${f.trim()}` };
  }

  // Allow WITH ... SELECT as well by checking that the first non-comment token eventually contains select
  if (!/\bselect\b/i.test(lowered)) return { ok: false, reason: 'No SELECT statement found.' };

  const tables = extractTableNames(raw);
  if (tables.length === 0) return { ok: false, reason: 'No table found in FROM/JOIN clauses.' };

  const disallowed = tables.filter(t => !ALLOWED_TABLES.includes(t));
  if (disallowed.length > 0) return { ok: false, reason: `Disallowed tables referenced: ${disallowed.join(', ')}`, tables };

  return { ok: true, tables };
}

// Remove markdown code fences and surrounding commentary; extract SQL starting at first SELECT
function sanitizeSQL(text) {
  if (!text) return '';
  let t = String(text).trim();
  // Extract content inside ```sql ... ``` or ``` ... ```
  const fenceMatch = t.match(/```(?:sql)?\n?([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim().replace(/;\s*$/, '');
  // Extract first code block with single backticks `...` if it looks like SQL
  const inlineMatch = t.match(/`([^`]+)`/);
  if (inlineMatch && /\bselect\b/i.test(inlineMatch[1])) return inlineMatch[1].trim().replace(/;\s*$/, '');
  // Otherwise, find first SELECT and return from there
  const sel = t.search(/\bselect\b/i);
  if (sel >= 0) {
    let s = t.slice(sel).trim();
    // drop trailing code fences or backticks
    s = s.replace(/```+$/g, '').replace(/^`+|`+$/g, '').trim();
    return s.replace(/;\s*$/, '');
  }
  // Fallback: remove any triple backticks and return trimmed
  return t.replace(/```/g, '').trim();
}

// ---- Flow: 1) Generate SQL via Mistral 2) Validate 3) Execute 4) Summarize via Mistral
export async function POST(req) {
  try {
    const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
    const body = await req.json();
    const question = body.question;
    let wantPDF = body.format && body.format.toLowerCase() === 'pdf';
    // Auto-trigger PDF generation if question contains keywords like 'print' or 'rekap' (Bahasa/English)
    if (!wantPDF && question && typeof question === 'string') {
      const lc = question.toLowerCase();
      const triggers = ['print', 'cetak', 'rekap', 'rekapan', 'export', 'download', 'unduh', 'pdf'];
      for (const t of triggers) if (lc.includes(t)) { wantPDF = true; break; }
    }
    if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 });

    if (!MISTRAL_API_KEY) return NextResponse.json({ error: 'Mistral API key not configured' }, { status: 500 });

    // Step 1: ask Mistral to generate only SQL
    const sqlPrompt = `You are a SQL generator for a CRM analytics chatbot.\nGiven a natural language question about members, orders, or products, return ONLY valid PostgreSQL SQL (no explanation).\nDatabase schema:\n- members(id uuid, name text, email text, joined_at timestamp)\n- products(id uuid, name text, price numeric, category text)\n- orders(id uuid, member_id uuid, order_date timestamp, total numeric)\n- order_items(id uuid, order_id uuid, product_id uuid, quantity int, subtotal numeric)\n\nQuestion: "${question}"\n\nReturn only SQL query in plain text, nothing else.`;

    const genResp = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'system', content: sqlPrompt }], temperature: 0 }),
    });
    if (!genResp.ok) {
      const b = await genResp.text();
      throw new Error(`SQL gen error: ${genResp.status} ${b}`);
    }
  const genJson = await genResp.json();
  // Debug: log raw Mistral SQL generation response
  console.log('Mistral SQL gen raw response:', JSON.stringify(genJson));
  let generatedSQL = genJson.choices?.[0]?.message?.content || '';
  // Sanitize possible markdown/code fences around SQL
  generatedSQL = sanitizeSQL(generatedSQL);
  console.log('Sanitized generated SQL:', generatedSQL);

    // Step 2: validate
    let v = validateSQL(generatedSQL);
    if (!v.ok) {
      // Ask Mistral to regenerate a STRICT SELECT-only query that uses only allowed tables
      const regenPrompt = `The previously generated SQL was invalid for safe execution.\nPlease provide a single valid PostgreSQL SELECT query ONLY (no explanation) that answers the same question, and use only these tables: ${ALLOWED_TABLES.join(', ')}.\nQuestion: ${question}`;
      const regenResp = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'system', content: regenPrompt }], temperature: 0 }),
      });
      if (regenResp.ok) {
        const regenJson = await regenResp.json();
        // Debug: log raw Mistral regeneration response
        console.log('Mistral SQL regen raw response:', JSON.stringify(regenJson));
        generatedSQL = (regenJson.choices?.[0]?.message?.content || '');
        generatedSQL = sanitizeSQL(generatedSQL);
        console.log('Sanitized regenerated SQL:', generatedSQL);
        v = validateSQL(generatedSQL);
      }
    }
    if (!v.ok) return NextResponse.json({ error: 'Generated SQL invalid', reason: v.reason, sql: generatedSQL }, { status: 400 });
    // Step 3 prep: fetch actual column names for the referenced tables and ask LLM to regenerate SQL using exact columns
    const supabase = getSupabase();

    // Try to parse a local schema file (if present) to get exact column names.
    function parseLocalSchema() {
      const candidates = [
        path.join(process.cwd(), 'schema_supabase.txt'),
        path.join(process.cwd(), '..', 'schema_supabase.txt'),
        path.join(process.cwd(), 'medherb-next', 'schema_supabase.txt'),
      ];
      for (const p of candidates) {
        try {
          if (!fs.existsSync(p)) continue;
          const txt = fs.readFileSync(p, 'utf8');
          const map = {};
          const re = /create table\s+([a-zA-Z_][\w]*)\s*\(([\s\S]*?)\);/gi;
          let m;
          while ((m = re.exec(txt)) !== null) {
            const tbl = m[1];
            const colsBlock = m[2];
            const cols = [];
            for (let line of colsBlock.split(/\r?\n/)) {
              line = line.trim();
              if (!line || line.startsWith('--')) continue;
              // remove trailing commas
              line = line.replace(/,+$/g, '').trim();
              // stop at constraint-only lines
              if (/^(primary key|unique|foreign key|constraint)\b/i.test(line)) continue;
              const parts = line.split(/\s+/);
              const col = parts[0].replace(/"|`/g, '').trim();
              if (col && !col.includes('(')) cols.push(col);
            }
            map[tbl] = cols;
          }
          return map;
        } catch (e) {
          // ignore and try next
        }
      }
      return null;
    }

    const localSchema = parseLocalSchema();

    async function fetchTableColumns(table) {
      try {
        // If we parsed a local schema file, prefer it (more reliable)
        if (localSchema && Array.isArray(localSchema[table]) && localSchema[table].length > 0) {
          return localSchema[table];
        }
        const q = `select json_agg(t) from (select column_name from information_schema.columns where table_name = '${table}' and table_schema = 'public' order by ordinal_position) t`;
        const res = await supabase.rpc('exec_sql', { query: q });
        if (res.error) throw res.error;
        // res.data might be an array or object; attempt to normalize
        let data = res.data;
        if (!data) return [];
        // If data is an array of objects like [{json_agg: [...] }] extract inner
        if (!Array.isArray(data) && data.json_agg) data = data.json_agg;
        // data may be array of objects with column_name keys
        if (Array.isArray(data)) {
          return data.map(r => (r.column_name || r['column_name'] || r.json_agg || r)).flat().filter(Boolean);
        }
        return [];
      } catch (err) {
        console.warn('Could not fetch columns for', table, err);
        return [];
      }
    }

    // Build schema info for LLM to regenerate using accurate column names
    const tableColumns = {};
    for (const t of v.tables) {
      tableColumns[t] = await fetchTableColumns(t);
    }
    const schemaSnippet = Object.entries(tableColumns).map(([t, cols]) => `- ${t}(${cols.join(', ')})`).join('\n');

    // Ask Mistral to regenerate SQL using exact columns (this avoids column-not-found errors)
    const schemaAwarePrompt = `Use only these tables and columns (exact schema):\n${schemaSnippet}\n\nQuestion: ${question}\n\nReturn ONLY a single valid PostgreSQL SELECT query that answers the question. No explanation.`;
    try {
      const schemaResp = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'system', content: schemaAwarePrompt }], temperature: 0 }),
      });
      if (schemaResp && schemaResp.ok) {
        const schJson = await schemaResp.json();
        console.log('Mistral schema-aware gen raw response:', JSON.stringify(schJson));
        const schSQL = sanitizeSQL(schJson.choices?.[0]?.message?.content || '');
        if (schSQL) {
          generatedSQL = schSQL;
          console.log('Sanitized schema-aware SQL:', generatedSQL);
          v = validateSQL(generatedSQL);
        }
      }
    } catch (e) {
      console.warn('Schema-aware regeneration failed:', e);
    }

    if (!v.ok) return NextResponse.json({ error: 'Generated SQL invalid', reason: v.reason, sql: generatedSQL }, { status: 400 });
    try {
      // Use the user-provided exec_sql function on the database to safely run the generated SQL and get JSON
      const rpcRes = await supabase.rpc('exec_sql', { query: generatedSQL });
      // supabase-js returns { data, error }
      if (rpcRes.error) throw rpcRes.error;
      // The RPC returns JSON as text; normalize to array
      const rows = Array.isArray(rpcRes.data) ? rpcRes.data : (rpcRes.data == null ? [] : rpcRes.data);
      // If the function returns an object with a key, try to extract the JSON_agg payload
      let normalizedRows = rows;
      if (!Array.isArray(normalizedRows) && normalizedRows && normalizedRows.result) normalizedRows = normalizedRows.result;
      if (!Array.isArray(normalizedRows) && normalizedRows && normalizedRows.json_agg) normalizedRows = normalizedRows.json_agg;

      // Step 4: summarize results via Mistral (moved here after obtaining rows)
      const summaryPrompt = `You are a concise assistant. Given the SQL query:\n${generatedSQL}\nAnd the query results as JSON:\n${JSON.stringify((normalizedRows || []).slice(0, 50))}\nProvide a short, human-friendly summary in Bahasa Indonesia, highlighting key numbers or top rows if relevant. Keep it brief.`;

      const sumResp = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'system', content: summaryPrompt }], temperature: 0.2 }),
      });
      if (!sumResp.ok) {
        const b = await sumResp.text();
        throw new Error(`Summary gen error: ${sumResp.status} ${b}`);
      }
      const sumJson = await sumResp.json();
      // Debug: log raw Mistral summary response
      console.log('Mistral summary raw response:', JSON.stringify(sumJson));
      const answer = sumJson.choices?.[0]?.message?.content || '(no summary)';

      // If caller requested a PDF, generate a simple PDF and return it
      if (wantPDF) {
        const pdfDoc = await PDFLibDocument.create();
        let page = pdfDoc.addPage([595, 842]); // A4 approx in points
        const { width } = page.getSize();
        const margin = 50;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        let y = 820 - margin;

        // Helper: wrap text to fit width using font metrics
        function drawWrappedText(text, { size = 12, bold = false, lineGap = 6, indent = 0 } = {}) {
          const usedFont = bold ? fontBold : font;
          const maxWidth = width - margin * 2 - indent;
          const words = String(text).replace(/\t/g, ' ').split(/\s+/);
          let line = '';
          const spaceWidth = usedFont.widthOfTextAtSize(' ', size);

          function flushLine(currLine) {
            if (!currLine) return;
            page.drawText(currLine, { x: margin + indent, y: y - (size + lineGap), size, font: usedFont, color: rgb(0, 0, 0) });
            y -= (size + lineGap);
            if (y < margin + 60) {
              page = pdfDoc.addPage([595, 842]);
              y = 820 - margin;
            }
          }

          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = line ? `${line} ${word}` : word;
            const testWidth = usedFont.widthOfTextAtSize(testLine, size);
            if (testWidth > maxWidth && line) {
              flushLine(line);
              line = word;
            } else {
              line = testLine;
            }
          }
          flushLine(line);
        }

        // Header
        const title = 'Laporan Rekap Penjualan';
        const dateStr = new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
        const titleSize = 22;
        const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
        page.drawText(title, { x: (width - titleWidth) / 2, y: y - titleSize, size: titleSize, font: fontBold });
        y -= titleSize + 8;
        drawWrappedText(`Tanggal pembuatan: ${dateStr}`, { size: 10 });
        y -= 6;

        // Decorative separator
        page.drawLine({ start: { x: margin, y: y }, end: { x: width - margin, y: y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
        y -= 18;

        // Summary block
        drawWrappedText('Ringkasan Eksekutif', { size: 14, bold: true });
        drawWrappedText(String(answer).replace(/\*\*/g, '').replace(/\n/g, ' '), { size: 11, lineGap: 8 });
        y -= 8;

        // Basic metrics
        const metrics = [];
        metrics.push(`Jumlah baris: ${(normalizedRows || []).length}`);
        if (v && v.tables) metrics.push(`Tabel: ${v.tables.join(', ')}`);
        drawWrappedText('\n', { size: 6 });
        drawWrappedText('Ringkasan Data', { size: 12, bold: true });
        drawWrappedText(metrics.join(' | '), { size: 11 });

        // Footer / branding
        const footer = 'Generated by SiMbah - Sistem Informasi Penjualan';
        const footerSize = 9;
        const footerWidth = font.widthOfTextAtSize(footer, footerSize);
        page.drawText(footer, { x: (width - footerWidth) / 2, y: 30, size: footerSize, font });

        const pdfBytes = await pdfDoc.save();
        return new NextResponse(Buffer.from(pdfBytes), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="rekap_penjualan.pdf"',
          },
        });
      }

      return NextResponse.json({ answer, executed_sql: generatedSQL, rowCount: (normalizedRows || []).length, rows: (normalizedRows || []).slice(0, 50) });
    } catch (rpcErr) {
      console.error('Exec SQL RPC error:', rpcErr);
      return NextResponse.json({ error: 'Database execution error', detail: String(rpcErr), sql: generatedSQL }, { status: 500 });
    }

    // Step 4: summarize results via Mistral
    const summaryPrompt = `You are a concise assistant. Given the SQL query:\n${generatedSQL}\nAnd the query results as JSON:\n${JSON.stringify((rows || []).slice(0, 50))}\nProvide a short, human-friendly summary in Bahasa Indonesia, highlighting key numbers or top rows if relevant. Keep it brief.`;

    const sumResp = await fetchWithRetry('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'system', content: summaryPrompt }], temperature: 0.2 }),
    });
    if (!sumResp.ok) {
      const b = await sumResp.text();
      throw new Error(`Summary gen error: ${sumResp.status} ${b}`);
    }
    const sumJson = await sumResp.json();
    const answer = sumJson.choices?.[0]?.message?.content || '(no summary)';

    return NextResponse.json({ answer, executed_sql: generatedSQL, rowCount: (rows || []).length, rows: (rows || []).slice(0, 50) });
  } catch (err) {
    console.error('💥 Error in /api/query:', err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
