// Creates a crypto payment address for an order using NOWPayments.
// Secrets needed: NOWPAYMENTS_API_KEY  (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are provided automatically)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const COINS = new Set(['btc', 'ltc', 'eth', 'sol', 'usdttrc20', 'usdterc20', 'bnbbsc']);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Please sign in first.' }, 401);

    const { order_id, pay_currency } = await req.json();
    if (!COINS.has(pay_currency)) return json({ error: 'Unsupported currency.' }, 400);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: o, error: oErr } = await admin.from('orders').select('*').eq('id', order_id).maybeSingle();
    if (oErr) return json({ error: 'Database error: ' + oErr.message }, 500);
    if (!o || o.user_id !== user.id) return json({ error: 'Order not found.' }, 404);
    if (o.method !== 'crypto' || o.status !== 'pending') return json({ error: 'This order cannot be paid anymore.' }, 400);

    let usd = Number(o.amount_usd);   // the order total in USD, computed when the order was created
    if (!(usd > 0)) {
      const { data: st, error: sErr } = await admin.from('settings').select('value').eq('key', 'dzd_per_usd').maybeSingle();
      if (sErr) return json({ error: 'Database error: ' + sErr.message }, 500);
      const rate = Number(st?.value);
      if (!(rate > 0)) return json({ error: 'Exchange rate is not set.' }, 500);
      usd = Math.ceil((o.amount_dzd / rate) * 100) / 100;
    }

    const r = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: { 'x-api-key': Deno.env.get('NOWPAYMENTS_API_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_amount: usd,
        price_currency: 'usd',
        pay_currency,
        ipn_callback_url: `${url}/functions/v1/crypto-ipn`,
        order_id: o.id,
        order_description: o.reference,
      }),
    });
    const p = await r.json();
    if (!r.ok) return json({ error: p.message || 'The payment provider refused the request.' }, 502);

    await admin.from('orders').update({
      crypto_currency: pay_currency,
      pay_address: p.pay_address,
      pay_amount: p.pay_amount,
      provider_payment_id: String(p.payment_id),
      provider_status: p.payment_status,
    }).eq('id', o.id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
