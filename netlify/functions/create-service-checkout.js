const { stripe } = require('./lib/stripe');
const { supabaseAdmin } = require('./lib/supabase');
const { ok, badRequest, serverError, handleOptions } = require('./lib/http');

function getOrigin(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host;
  return `${proto}://${host}`;
}

function normalizeString(value) {
  return String(value || '').trim();
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event.httpMethod);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== 'POST') {
    return badRequest('POST only');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const slug = normalizeString(body.slug);
    const firstName = normalizeString(body.firstName);
    const lastName = normalizeString(body.lastName);
    const email = normalizeString(body.email).toLowerCase();
    const phone = normalizeString(body.phone);
    const serviceSelection = normalizeString(body.serviceSelection);
    const preferredContactMethod = normalizeString(body.preferredContactMethod);
    const preferredCallTime = normalizeString(body.preferredCallTime);
    const inquiryMessage = normalizeString(body.inquiryMessage);

    if (!slug) return badRequest('Missing service slug.');
    if (!firstName || !lastName || !email || !phone) {
      return badRequest('First name, last name, email, and phone are required.');
    }
    if (!preferredContactMethod) {
      return badRequest('Choose a preferred contact method.');
    }
    if (preferredContactMethod === 'Phone call' && !preferredCallTime) {
      return badRequest('Tell us your preferred call time.');
    }

    const { data: service, error: serviceError } = await supabaseAdmin
      .from('service_offers')
      .select('id, slug, title, short_description, price_aud, stripe_price_id, deposit_percent, is_published')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (serviceError || !service) {
      return badRequest('That service is not available right now.');
    }

    if (!service.price_aud || Number(service.price_aud) <= 0) {
      return badRequest('This service is not purchasable yet.');
    }

    const totalPrice = Number(service.price_aud);
    const depositPercent = Number(service.deposit_percent || 50);
    const depositAmount = Number((totalPrice * (depositPercent / 100)).toFixed(2));
    const balanceDue = Number((totalPrice - depositAmount).toFixed(2));

    const { data: order, error: orderError } = await supabaseAdmin
      .from('service_orders')
      .insert({
        email,
        full_name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        phone,
        service_offer_id: service.id,
        amount_aud: depositAmount,
        balance_due_aud: balanceDue,
        preferred_contact_method: preferredContactMethod,
        preferred_call_time: preferredCallTime || null,
        inquiry_message: inquiryMessage,
        deposit_percent: depositPercent,
        intake_payload: {
          firstName,
          lastName,
          email,
          phone,
          serviceSelection: serviceSelection || service.title,
          preferredContactMethod,
          preferredCallTime: preferredCallTime || null,
          inquiryMessage,
        },
        metadata: {
          slug: service.slug,
          serviceSelection: serviceSelection || service.title,
        },
      })
      .select('id')
      .single();

    if (orderError || !order) {
      console.error('[create-service-checkout] order insert failed', orderError);
      return serverError('Could not start checkout right now.');
    }

    const origin = getOrigin(event);
    const successUrl = `${origin}/service-success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/service.html?slug=${encodeURIComponent(service.slug)}`;

    const lineItem = service.stripe_price_id
      ? {
          price: service.stripe_price_id,
          quantity: 1,
        }
      : {
          price_data: {
            currency: 'aud',
            product_data: {
              name: `${service.title} deposit`,
              description: `50% deposit for ${service.title}`,
            },
            unit_amount: Math.round(depositAmount * 100),
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      billing_address_collection: 'auto',
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        kind: 'service',
        order_id: order.id,
        slug: service.slug,
      },
    });

    await supabaseAdmin
      .from('service_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    return ok({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[create-service-checkout] unexpected error', error);
    return serverError('Could not start checkout right now.');
  }
};
