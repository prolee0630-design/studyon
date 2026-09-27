import { getStore } from '@netlify/blobs';

const store = getStore({ name: 'studyon-answer-bank', consistency: 'strong' });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const clean = (value, limit = 120) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const normal = value => clean(value, 400).toLowerCase().replace(/\s+/g, '').replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, char => String('①②③④⑤⑥⑦⑧⑨⑩'.indexOf(char) + 1));
const keyFor = ({ bankId, book, chapter, page, question }) => `answers/${encodeURIComponent(bankId)}/${[book, chapter, page, question].map(value => encodeURIComponent(clean(value))).join('/')}`;
const valid = entry => {
  const book = clean(entry.book), chapter = clean(entry.chapter), page = clean(entry.page, 20), question = clean(entry.question, 20), answer = clean(entry.answer, 400), manual = entry.manual === true;
  if (!book || !chapter || !/^\d{1,5}$/.test(page) || !/^\d{1,5}$/.test(question) || (!manual && !normal(answer))) return null;
  return { book, chapter, page, question, answer, manual };
};

export default async request => {
  if (request.method === 'GET') return json({ ready: true });
  if (request.method !== 'POST') return json({ error: '지원하지 않는 요청이에요.' }, 405);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: '요청 형식을 확인해 주세요.' }, 415);
  let body;
  try { body = await request.json(); } catch { return json({ error: '입력 형식을 확인해 주세요.' }, 400); }
  if (body.action === 'grade') {
    const query = valid({ ...body, answer: 'placeholder' }), bankId = clean(body.bankId, 80), answer = clean(body.answer, 400);
    if (!query || !bankId) return json({ error: '교재, 단원, 페이지와 문제 번호를 확인해 주세요.' }, 400);
    const stored = await store.get(keyFor({ ...query, bankId }), { type: 'json', consistency: 'strong' });
    if (!stored) return json({ error: '등록된 답지를 찾지 못했어요. 교재·단원·페이지·문제 번호를 확인해 주세요.' }, 404);
    if (stored.manual) return json({ verdict: 'manual' });
    if (!normal(answer)) return json({ error: '내 답을 입력해 주세요.' }, 400);
    return json({ verdict: normal(stored.answer) === normal(answer) ? 'correct' : 'incorrect' });
  }
  if (body.action === 'register') {
    const bankId = clean(body.bankId, 80);
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(bankId)) return json({ error: '답지 보관함을 확인해 주세요.' }, 400);
    if (!Array.isArray(body.entries) || !body.entries.length || body.entries.length > 500) return json({ error: '한 번에 1~500개 답만 등록할 수 있어요.' }, 400);
    const entries = body.entries.map(valid);
    if (entries.some(entry => !entry)) return json({ error: '답지 형식을 확인해 주세요.' }, 400);
    const now = new Date().toISOString();
    await Promise.all(entries.map(entry => store.setJSON(keyFor({ ...entry, bankId }), { answer: entry.answer, manual: entry.manual, updatedAt: now })));
    return json({ saved: entries.length });
  }
  return json({ error: '지원하지 않는 작업이에요.' }, 400);


