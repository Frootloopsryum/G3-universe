const { supabaseAdmin } = require('./lib/supabase');
const { ok, badRequest, serverError, handleOptions, json } = require('./lib/http');

async function getUserFromBearer(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    console.warn('[save-hub-profile] auth failed', error?.message);
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
    if (!user?.id || !user?.email) {
      return json(401, { error: 'Not authenticated.' });
    }

    const body = JSON.parse(event.body || '{}');
    const nickname = String(body.nickname || '').trim();

    if (!nickname) return badRequest('Nickname is required.');
    if (nickname.length > 30) return badRequest('Nickname must be 30 characters or fewer.');

    const { data: operator, error: operatorError } = await supabaseAdmin
      .from('operators')
      .select('id, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (operatorError || !operator?.id) {
      console.warn('[save-hub-profile] operator lookup failed', operatorError?.message);
      return badRequest('Your operator profile could not be found.');
    }

    const { data: accessData, error: accessError } = await supabaseAdmin.rpc('get_operator_access', {
      candidate_email: operator.email || user.email,
    });

    if (accessError) {
      console.warn('[save-hub-profile] access lookup failed', accessError.message);
      return serverError('Hub access could not be verified right now.');
    }

    if (!accessData?.membership_active && !accessData?.is_admin) {
      return json(403, { error: 'The Members Hub is only for active Studio subscribers right now.' });
    }

    const { data: existingNickname } = await supabaseAdmin
      .from('hub_member_profiles')
      .select('operator_id')
      .eq('nickname', nickname)
      .maybeSingle();

    if (existingNickname?.operator_id && existingNickname.operator_id !== operator.id) {
      return badRequest('That nickname is taken already.');
    }

    const { data: currentProfile, error: currentProfileError } = await supabaseAdmin
      .from('hub_member_profiles')
      .select('nickname, last_nickname_change_at')
      .eq('operator_id', operator.id)
      .maybeSingle();

    if (currentProfileError) {
      console.warn('[save-hub-profile] current profile lookup failed', currentProfileError.message);
      return serverError('Current Hub profile could not be loaded.');
    }

    if (currentProfile?.last_nickname_change_at && currentProfile.nickname !== nickname) {
      const nextAllowed = new Date(currentProfile.last_nickname_change_at);
      nextAllowed.setDate(nextAllowed.getDate() + 30);
      if (new Date() < nextAllowed) {
        return badRequest(`You can change your nickname again after ${nextAllowed.toLocaleDateString('en-AU')}.`);
      }
    }

    const payload = {
      operator_id: operator.id,
      nickname,
      last_nickname_change_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: savedProfile, error: saveError } = await supabaseAdmin
      .from('hub_member_profiles')
      .upsert(
        currentProfile ? payload : { ...payload, created_at: new Date().toISOString() },
        { onConflict: 'operator_id' },
      )
      .select('nickname, last_nickname_change_at')
      .single();

    if (saveError) {
      console.error('[save-hub-profile] save failed', saveError);
      return serverError(saveError.message || 'Nickname could not be saved right now.');
    }

    return ok({
      ok: true,
      isFirstTime: !currentProfile,
      profile: savedProfile,
    });
  } catch (error) {
    console.error('[save-hub-profile] failed', error);
    return serverError('Nickname could not be saved right now.');
  }
};
