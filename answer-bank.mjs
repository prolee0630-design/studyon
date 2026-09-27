export default async () => new Response(JSON.stringify({ ready: true }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
