const { stripe } = require('./lib/stripe');
const { supabaseAdmin } = require('./lib/supabase');
const { ok, badRequest, serverError, handleOptions } = require('./lib/http');

function getOrigin(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host;
  return `${proto}://${host}`;
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event.httpMethod);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== 'POST') {
    return badRequest('POST only');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const slug = String(body.slug || '').trim();
    if (!slug) return badRequest('Missing product slug.');

    const { data: product, error: productError } = await supabaseAdmin
      .from('store_products')
      .select('id, slug, title, short_description, long_description, bullet_points, price_aud, stripe_price_id, download_url, cta_label, is_published')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (productError || !product) {
      return badRequest('That product is not available right now.');
    }

    if (!product.price_aud || Number(product.price_aud) <= 0) {
      return badRequest('This product is not purchasable yet.');
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('product_orders')
      .insert({
        product_id: product.id,
        full_name: null,
        email: '',
        customer_email: null,
        amount_aud: Number(product.price_aud),
        status: 'pending',
        download_url_snapshot: product.download_url || null,
        metadata: {
          slug: product.slug,
          title: product.title,
        },
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('[create-product-checkout] order insert failed', orderError);
      return serverError('Could not start checkout right now.');
    }

    const origin = getOrigin(event);
    const successUrl = `${origin}/product-success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/product.html?slug=${encodeURIComponent(product.slug)}`;

    const lineItem = product.stripe_price_id
      ? {
          price: product.stripe_price_id,
          quantity: 1,
        }
      : {
          price_data: {
            currency: 'aud',
            product_data: {
              name: product.title,
              description: product.short_description,
            },
            unit_amount: Math.round(Number(product.price_aud) * 100),
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      billing_address_collection: 'auto',
      customer_creation: 'always',
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        kind: 'product',
        order_id: order.id,
        slug: product.slug,
      },
    });

    await supabaseAdmin
      .from('product_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    return ok({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[create-product-checkout] unexpected error', error);
    return serverError('Could not start checkout right now.');
  }
};
