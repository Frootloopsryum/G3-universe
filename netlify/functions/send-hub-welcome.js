const { supabaseAdmin } = require('./lib/supabase');
const { ok, badRequest, serverError, handleOptions } = require('./lib/http');
const { sendEmail, hubWelcomeEmailHtml } = require('./lib/email');

async function getUserFromBearer(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    console.warn('[send-hub-welcome] auth failed', error?.message);
    return null;
  }

  return data.user;
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event.httpMethod);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== 'POST') return badRequest('POST only');

  try {
    const user = await getUserFromBearer(event);
    if (!user?.email) return badRequest('Not authenticated.');

    const body = JSON.parse(event.body || '{}');
    const nickname = String(body.nickname || '').trim();
    if (!nickname) return badRequest('Missing nickname.');

    const hubUrl = `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers.host}/members`;

    await sendEmail({
      to: user.email,
      subject: 'Welcome to the G3 Members Hub',
      html: hubWelcomeEmailHtml({ nickname, hubUrl }),
    });

    return ok({ ok: true });
  } catch (error) {
    console.error('[send-hub-welcome] failed', error);
    return serverError('Welcome email could not be sent right now.');
  }
};
