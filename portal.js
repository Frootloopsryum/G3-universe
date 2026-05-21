import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?bundle';

const SUPABASE_URL = 'https://foarlngpaotkbsvtqqwm.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvYXJsbmdwYW90a2JzdnRxcXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDY1NjgsImV4cCI6MjA5MTI4MjU2OH0.6BJM1jOw1nL9Tm7bkg7JwcYuE_voBG5bga2fsv9iYIU';
const STUDIO_APP_URL = 'https://studio.g3universe.com/';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

function buildLaunchUrl(session, path = '/') {
  const url = new URL(path, STUDIO_APP_URL);
  url.searchParams.set('access_token', session.access_token);
  url.searchParams.set('refresh_token', session.refresh_token);
  url.searchParams.set('from', 'portal');
  return url.toString();
}

async function ensureOperatorRow(userId, email) {
  const { data: existing, error: selectError } = await supabase
    .from('operators')
    .select('auth_user_id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return;

  const { error: insertError } = await supabase.from('operators').insert({
    auth_user_id: userId,
    display_name: email,
    email,
  });

  if (insertError) throw insertError;
}

async function lookupOperatorByEmail(candidateEmail) {
  const { data, error } = await supabase
    .from('operators')
    .select('id, onboarding_done')
    .eq('email', candidateEmail)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function setPortalError(message) {
  const errorNode = document.getElementById('portalError');
  if (!errorNode) return;
  errorNode.textContent = message || '';
  errorNode.hidden = !message;
}

function setPortalInfo(message) {
  const infoNode = document.getElementById('portalInfo');
  if (!infoNode) return;
  infoNode.textContent = message || '';
  infoNode.hidden = !message;
}

async function handleAuthSubmit(event, mode) {
  event.preventDefault();

  const emailInput = document.getElementById('portalEmail');
  const passwordInput = document.getElementById('portalPassword');
  const submitButton = document.getElementById('portalSubmit');

  if (!emailInput || !passwordInput || !submitButton) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setPortalError('Please enter your email and password.');
    return;
  }

  setPortalError('');
  setPortalInfo('');
  submitButton.disabled = true;
  submitButton.textContent = mode === 'login' ? 'Signing in...' : 'Creating account...';

  try {
    let authResult;

    if (mode === 'login') {
      authResult = await supabase.auth.signInWithPassword({ email, password });
    } else {
      authResult = await supabase.auth.signUp({ email, password });
      const alreadyExists =
        authResult.error?.message?.toLowerCase().includes('already registered') ||
        authResult.error?.message?.toLowerCase().includes('already exists') ||
        (authResult.data?.user && (authResult.data.user.identities?.length ?? 1) === 0);

      if (alreadyExists) {
        authResult = await supabase.auth.signInWithPassword({ email, password });
      }
    }

    if (authResult.error) throw authResult.error;
    if (authResult.data?.user) {
      await ensureOperatorRow(authResult.data.user.id, email);
    }
  } catch (error) {
    setPortalError(error?.message ?? 'Something went wrong. Please try again.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = mode === 'login' ? 'Sign in' : 'Create account';
  }
}

async function renderPortalState(session, mode) {
  const signedOut = document.getElementById('portalSignedOut');
  const signedIn = document.getElementById('portalSignedIn');
  const sessionCopy = document.getElementById('portalSessionCopy');
  const workspaceLink = document.getElementById('portalWorkspaceLink');
  const appLink = document.getElementById('portalAppLink');
  const toggleButton = document.getElementById('portalModeToggle');
  const submitButton = document.getElementById('portalSubmit');

  if (!signedOut || !signedIn || !toggleButton || !submitButton) return;

  if (!session) {
    signedOut.hidden = false;
    signedIn.hidden = true;
    submitButton.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    toggleButton.textContent =
      mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in';
    return;
  }

  const launchUrl = buildLaunchUrl(session, '/');
  const workspaceUrl = new URL('workspace.html', window.location.href);
  workspaceUrl.searchParams.set('access_token', session.access_token);
  workspaceUrl.searchParams.set('refresh_token', session.refresh_token);

  signedOut.hidden = true;
  signedIn.hidden = false;
  if (sessionCopy) {
    sessionCopy.textContent = `Signed in as ${session.user.email}. Open Studio in the portal or jump straight into the full-screen app.`;
  }
  if (workspaceLink) workspaceLink.href = workspaceUrl.toString();
  if (appLink) appLink.href = launchUrl;
}

function bootStudioPortal() {
  const form = document.getElementById('portalAuthForm');
  const toggleButton = document.getElementById('portalModeToggle');
  const signOutButton = document.getElementById('portalSignOut');
  const forgotPasswordButton = document.getElementById('portalForgotPassword');
  let mode = 'login';

  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      mode = mode === 'login' ? 'signup' : 'login';
      setPortalError('');
      setPortalInfo('');
      renderPortalState(null, mode);
    });
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      handleAuthSubmit(event, mode);
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      await supabase.auth.signOut();
      renderPortalState(null, mode);
    });
  }

  if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener('click', async () => {
      const emailInput = document.getElementById('portalEmail');
      const submitButton = document.getElementById('portalSubmit');
      if (!emailInput || !submitButton) return;

      const email = emailInput.value.trim();
      setPortalError('');
      setPortalInfo('');

      if (!email) {
        setPortalError('Enter your email first, then tap forgot password.');
        return;
      }

      forgotPasswordButton.disabled = true;
      const originalText = forgotPasswordButton.textContent;
      forgotPasswordButton.textContent = 'Sending...';

      let operator = null;

      try {
        operator = await lookupOperatorByEmail(email);
      } catch (lookupError) {
        forgotPasswordButton.disabled = false;
        forgotPasswordButton.textContent = originalText;
        setPortalError(lookupError?.message ?? 'Could not check that email right now. Please try again.');
        return;
      }

      if (!operator) {
        forgotPasswordButton.disabled = false;
        forgotPasswordButton.textContent = originalText;
        setPortalError('No operator account exists with that email yet. Create your account instead.');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: STUDIO_APP_URL,
      });

      forgotPasswordButton.disabled = false;
      forgotPasswordButton.textContent = originalText;

      if (error) {
        setPortalError(error.message);
        return;
      }

      if (operator.onboarding_done === false) {
        setPortalInfo('There is an incomplete profile for this account. Reset your password, then continue setup in Studio.');
        return;
      }

      setPortalInfo('Password reset link sent. Check your email and follow the reset link to choose a new password.');
    });
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    renderPortalState(session, mode);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    renderPortalState(session, mode);
  });
}

async function bootWorkspacePortal() {
  const iframe = document.getElementById('workspaceFrame');
  const status = document.getElementById('workspaceStatus');
  const appLink = document.getElementById('workspaceAppLink');
  const toolbarLink = document.getElementById('workspaceToolbarLink');

  if (!iframe || !status) return;

  const url = new URL(window.location.href);
  const accessToken = url.searchParams.get('access_token');
  const refreshToken = url.searchParams.get('refresh_token');

  let session = null;

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!error) {
      session = data.session;
      url.searchParams.delete('access_token');
      url.searchParams.delete('refresh_token');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
  }

  if (!session) {
    const { data } = await supabase.auth.getSession();
    session = data.session;
  }

  if (!session) {
    status.textContent = 'Your portal session expired. Head back to the studio portal and sign in again.';
    iframe.hidden = true;
    return;
  }

  const launchUrl = buildLaunchUrl(session, '/');
  iframe.src = launchUrl;
  iframe.hidden = false;
  status.textContent = 'Studio loaded inside the portal. Open full screen any time if you want the faster app shell.';
  if (appLink) appLink.href = launchUrl;
  if (toolbarLink) toolbarLink.href = launchUrl;
}

const page = document.body.dataset.page;
if (page === 'studio-portal') {
  bootStudioPortal();
}

if (page === 'studio-workspace') {
  bootWorkspacePortal();
}
