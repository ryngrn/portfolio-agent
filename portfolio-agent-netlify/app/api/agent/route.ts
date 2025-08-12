import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'node:fs';

type Chunk = { id: string; text: string; source: string; embedding: number[] };

// Load embeddings at cold start from the filesystem
const EMBEDDINGS: Chunk[] = JSON.parse(fs.readFileSync('data/embeddings.json', 'utf8') || '[]');

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function embedQuery(q: string) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const r = await client.embeddings.create({ model, input: q });
  return r.data[0].embedding as number[];
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const userMsg = messages?.[messages.length - 1]?.content || '';
    const qEmbed = await embedQuery(userMsg);

    const top = EMBEDDINGS.map(e => ({ ...e, score: cosine(qEmbed, e.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const contextBlocks = top.map(s => `SOURCE: ${s.source}\n${s.text}`).join('\n\n');

    const system = `You are "PortfolioAgent" answering questions about Ryan Green's experience, PM approach, design background, technical skills, and projects.\n\nRules:\n- Answer only from the provided SOURCES. If unsure, say you don't know.\n- Keep answers concise and friendly.\n- Cite sources at the end like [1], [2] using the file basenames of the SOURCES.`;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `CONTEXT:\n${contextBlocks}\n\nQUESTION: ${userMsg}` }
      ],
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content || 'Sorry, no response.';
    const uniq = Array.from(new Set(top.map(s => s.source.split('/').pop())));
    const cited = `${text}\n\nSources: ${uniq.map((n, i) => `[${i + 1}] ${n}`).join(', ')}`;

    return NextResponse.json({ reply: cited });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error' }, { status: 500 });
  }
}
