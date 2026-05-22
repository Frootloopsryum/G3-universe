const { stripe } = require('./lib/stripe');
const { supabaseAdmin } = require('./lib/supabase');
const { ok, badRequest, serverError, handleOptions } = require('./lib/http');
const { sendEmail, productEmailHtml } = require('./lib/email');

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event.httpMethod);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== 'GET') {
    return badRequest('GET only');
  }

  try {
    const sessionId = event.queryStringParameters?.session_id;
    if (!sessionId) return badRequest('Missing session_id.');

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.order_id;
    if (!orderId) return badRequest('This checkout session is missing order metadata.');
    if (session.payment_status !== 'paid') return badRequest('Payment is not complete yet.');

    const { data: order, error: orderError } = await supabaseAdmin
      .from('product_orders')
      .select(`
        id,
        status,
        amount_aud,
        email_sent_at,
        download_url_snapshot,
        metadata,
        store_products (
          title,
          slug,
          download_url,
          short_description
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('[complete-product-order] order lookup failed', orderError);
      return serverError('We could not finalise this order.');
    }

    const product = Array.isArray(order.store_products) ? order.store_products[0] : order.store_products;
    const downloadUrl = order.download_url_snapshot || product?.download_url || null;
    const customerEmail = session.customer_details?.email || session.customer_email || null;
    const customerName = session.customer_details?.name || null;

    await supabaseAdmin
      .from('product_orders')
      .update({
        status: 'paid',
        email: customerEmail || order.email || '',
        customer_email: customerEmail,
        full_name: customerName,
        amount_aud: Number(session.amount_total || 0) / 100,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
        download_url_snapshot: downloadUrl,
      })
      .eq('id', orderId);

    if (customerEmail && downloadUrl && !order.email_sent_at) {
      await sendEmail({
        to: customerEmail,
        subject: `Your ${product?.title || 'G3'} download`,
        html: productEmailHtml({
          title: product?.title || 'your file',
          downloadUrl,
        }),
      });

      await supabaseAdmin
        .from('product_orders')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', orderId);
    }

    return ok({
      ok: true,
      product: {
        title: product?.title || 'Your download',
        shortDescription: product?.short_description || '',
        slug: product?.slug || null,
      },
      downloadUrl,
      customerEmail,
    });
  } catch (error) {
    console.error('[complete-product-order] unexpected error', error);
    return serverError('We could not finalise this order.');
  }
};
