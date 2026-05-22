const { stripe } = require('./lib/stripe');
const { supabaseAdmin } = require('./lib/supabase');
const { ok, badRequest, serverError, handleOptions } = require('./lib/http');
const { sendEmail, serviceEmailHtml } = require('./lib/email');

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
      .from('service_orders')
      .select(`
        id,
        email,
        first_name,
        last_name,
        preferred_contact_method,
        preferred_call_time,
        inquiry_message,
        amount_aud,
        balance_due_aud,
        email_sent_at,
        metadata,
        service_offers (
          title,
          slug,
          short_description
        )
      `)
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error('[complete-service-order] order lookup failed', orderError);
      return serverError('We could not finalise this order.');
    }

    const service = Array.isArray(order.service_offers) ? order.service_offers[0] : order.service_offers;
    const customerEmail = session.customer_details?.email || session.customer_email || order.email || null;

    await supabaseAdmin
      .from('service_orders')
      .update({
        status: 'paid',
        email: customerEmail || order.email,
        amount_aud: Number(session.amount_total || 0) / 100,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
      })
      .eq('id', orderId);

    if (customerEmail && !order.email_sent_at) {
      await sendEmail({
        to: customerEmail,
        subject: `Your ${service?.title || 'G3'} enquiry is in`,
        html: serviceEmailHtml({
          serviceTitle: service?.title || 'service',
          customerName: `${order.first_name || ''} ${order.last_name || ''}`.trim() || 'there',
          depositAmount: Number(order.amount_aud || 0),
          balanceDue: Number(order.balance_due_aud || 0),
          preferredContactMethod: order.preferred_contact_method,
          preferredCallTime: order.preferred_call_time,
          inquiryMessage: order.inquiry_message,
        }),
      });

      await supabaseAdmin
        .from('service_orders')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', orderId);
    }

    return ok({
      ok: true,
      service: {
        title: service?.title || 'Your service enquiry',
        shortDescription: service?.short_description || '',
        slug: service?.slug || null,
      },
      order: {
        firstName: order.first_name,
        lastName: order.last_name,
        preferredContactMethod: order.preferred_contact_method,
        preferredCallTime: order.preferred_call_time,
        inquiryMessage: order.inquiry_message,
        depositAmount: Number(order.amount_aud || 0),
        balanceDue: Number(order.balance_due_aud || 0),
      },
    });
  } catch (error) {
    console.error('[complete-service-order] unexpected error', error);
    return serverError('We could not finalise this order.');
  }
};
