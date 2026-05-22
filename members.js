import { supabaseAuth } from './supabase-auth.js';
import { escapeHtml, setBusy, resetBusy } from './catalog-common.js';

const gate = document.getElementById('membersGate');
const app = document.getElementById('membersApp');
const errorBox = document.getElementById('membersError');
const infoBox = document.getElementById('membersInfo');
const loginForm = document.getElementById('membersLoginForm');
const loginButton = document.getElementById('membersLoginButton');
const roomList = document.getElementById('membersRoomList');
const roomTitle = document.getElementById('membersRoomTitle');
const roomKicker = document.getElementById('membersRoomKicker');
const messageFeed = document.getElementById('membersMessageFeed');
const messageForm = document.getElementById('membersMessageForm');
const messageInput = document.getElementById('membersMessageInput');
const messageSubmit = document.getElementById('membersMessageSubmit');
const composeHint = document.getElementById('membersComposeHint');
const resourcesSection = document.getElementById('resourcesSection');
const chatSection = document.getElementById('chatSection');
const resourceForm = document.getElementById('membersResourceForm');
const resourceSubmit = document.getElementById('membersResourceSubmit');
const resourceGroups = document.getElementById('membersResourceGroups');
const resourceType = document.getElementById('resourceType');
const resourceUrl = document.getElementById('resourceUrl');
const resourceFile = document.getElementById('resourceFile');
const resourceLinkWrap = document.getElementById('resourceLinkWrap');
const resourceFileWrap = document.getElementById('resourceFileWrap');
const nicknameModal = document.getElementById('nicknameModal');
const nicknameForm = document.getElementById('nicknameForm');
const nicknameInput = document.getElementById('nicknameInput');
const nicknameError = document.getElementById('nicknameError');
const nicknamePill = document.getElementById('membersNicknamePill');
const signOutButton = document.getElementById('membersSignOut');
const changeNicknameButton = document.getElementById('changeNicknameButton');
const membersGateCopy = document.getElementById('membersGateCopy');

let currentSession = null;
let currentOperator = null;
let currentProfile = null;
let currentRoomSlug = 'main';
let roomCache = [];
let messageSubscription = null;
let resourceSubscription = null;
let activeSection = 'chat';

function showError(message) {
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

function showInfo(message) {
  infoBox.hidden = false;
  infoBox.textContent = message;
}

function clearInfo() {
  infoBox.hidden = true;
  infoBox.textContent = '';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function startOfTodayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function setSection(section) {
  activeSection = section;
  chatSection.hidden = section !== 'chat';
  resourcesSection.hidden = section !== 'resources';
  document.querySelectorAll('.members-segment').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === section);
  });
}

function renderRoomList() {
  roomList.innerHTML = roomCache
    .map(
      (room) => `
        <button class="members-room ${room.slug === currentRoomSlug ? 'active' : ''}" data-room="${escapeHtml(room.slug)}" type="button">
          <strong>${escapeHtml(room.title)}</strong>
          <span>${escapeHtml(room.description || '')}</span>
        </button>
      `,
    )
    .join('');

  roomList.querySelectorAll('.members-room').forEach((button) => {
    button.addEventListener('click', async () => {
      currentRoomSlug = button.dataset.room;
      renderRoomList();
      await loadMessages();
    });
  });
}

function roomMeta(slug) {
  return roomCache.find((room) => room.slug === slug) || { title: 'Main', description: '' };
}

function renderMessages(messages) {
  const meta = roomMeta(currentRoomSlug);
  roomTitle.textContent = meta.title;
  roomKicker.textContent = `${meta.title} room`;
  composeHint.textContent =
    currentRoomSlug === 'promo-support'
      ? 'Promo Support is capped at one promo post per member per day.'
      : meta.description || 'Say the useful thing, ask the question, or have the vent.';

  if (!messages.length) {
    messageFeed.innerHTML = `<div class="members-empty">No messages yet. You get to break the silence.</div>`;
    return;
  }

  messageFeed.innerHTML = messages
    .map((message) => {
      const isOwn = message.operator_id === currentOperator.id;
      const pinned = message.pinned ? '<span class="members-message-pill">Pinned</span>' : '';
      const removed = message.is_removed;
      const body = removed ? 'Removed by admin' : escapeHtml(message.message_body);

      return `
        <article class="members-message ${isOwn ? 'is-own' : ''}">
          <header>
            <strong>${escapeHtml(message.author_nickname || message.display_name || 'Member')}</strong>
            <div class="members-message-meta">
              ${pinned}
              <span>${new Date(message.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
          </header>
          <p>${body}</p>
          ${
            !removed
              ? `<button class="members-report-button" data-id="${escapeHtml(message.id)}" data-type="message" type="button">Report</button>`
              : ''
          }
        </article>
      `;
    })
    .join('');

  messageFeed.querySelectorAll('.members-report-button').forEach((button) => {
    button.addEventListener('click', () => reportMessage(button.dataset.id));
  });
}

function resourceCard(resource, canEdit) {
  const actionUrl = resource.resource_type === 'file' ? resource.file_path : resource.external_url;
  const previewImage = resource.preview_image_url
    ? `<img src="${escapeHtml(resource.preview_image_url)}" alt="" class="members-link-preview-image" />`
    : '';

  return `
    <article class="members-resource-card">
      ${previewImage}
      <div class="members-resource-copy">
        <div class="members-resource-topline">
          <strong>${escapeHtml(resource.title)}</strong>
          <span>${escapeHtml(resource.uploader_nickname || 'Member')}</span>
        </div>
        ${resource.description ? `<p>${escapeHtml(resource.description)}</p>` : ''}
        ${
          resource.resource_type === 'link' && resource.preview_title
            ? `<div class="members-link-preview">
                <strong>${escapeHtml(resource.preview_title)}</strong>
                ${resource.preview_description ? `<span>${escapeHtml(resource.preview_description)}</span>` : ''}
              </div>`
            : ''
        }
        <div class="members-resource-actions">
          ${
            actionUrl
              ? `<a class="button button-ghost" href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener">${resource.resource_type === 'file' ? 'Open file' : 'Open link'}</a>`
              : ''
          }
          <button class="members-report-button" data-id="${escapeHtml(resource.id)}" data-type="resource" type="button">Report</button>
          ${
            canEdit
              ? `<button class="members-inline-action" data-action="edit" data-id="${escapeHtml(resource.id)}" type="button">Edit</button>
                 <button class="members-inline-action danger" data-action="delete" data-id="${escapeHtml(resource.id)}" type="button">Delete</button>`
              : ''
          }
        </div>
      </div>
    </article>
  `;
}

function renderResources(resources) {
  const categories = ['Lash Maps', 'Brow Tips', 'Links', 'Other'];
  const grouped = categories
    .map((category) => ({
      category,
      items: resources.filter((resource) => resource.category === category),
    }))
    .filter((group) => group.items.length > 0);

  if (!grouped.length) {
    resourceGroups.innerHTML = `<div class="members-empty">Nothing shared yet. Be the useful one.</div>`;
    return;
  }

  resourceGroups.innerHTML = grouped
    .map(
      (group) => `
        <section class="members-resource-group">
          <h2>${escapeHtml(group.category)}</h2>
          <div class="members-resource-list">
            ${group.items
              .map((resource) => resourceCard(resource, resource.operator_id === currentOperator.id))
              .join('')}
          </div>
        </section>
      `,
    )
    .join('');

  resourceGroups.querySelectorAll('.members-report-button[data-type="resource"]').forEach((button) => {
    button.addEventListener('click', () => reportResource(button.dataset.id));
  });

  resourceGroups.querySelectorAll('.members-inline-action').forEach((button) => {
    button.addEventListener('click', () => {
      const resourceId = button.dataset.id;
      if (button.dataset.action === 'edit') {
        editResource(resourceId);
      } else {
        deleteResource(resourceId);
      }
    });
  });
}

async function loadMessages() {
  const { data, error } = await supabaseAuth
    .from('hub_messages')
    .select('id, operator_id, display_name, author_nickname, message_body, created_at, room_slug, is_removed, pinned')
    .eq('room_slug', currentRoomSlug)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    showError(error.message);
    return;
  }

  renderMessages(data || []);
}

async function loadResources() {
  const { data, error } = await supabaseAuth
    .from('hub_resources')
    .select(`
      id,
      operator_id,
      title,
      description,
      category,
      resource_type,
      file_path,
      external_url,
      uploader_nickname,
      preview_title,
      preview_description,
      preview_image_url,
      created_at
    `)
    .eq('is_removed', false)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    showError(error.message);
    return;
  }

  renderResources(data || []);
}

async function ensureOperator() {
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();
  if (error || !user?.email) {
    throw new Error('We could not resolve your account right now.');
  }

  const { data: operator, error: operatorError } = await supabaseAuth
    .from('operators')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (operatorError || !operator) {
    throw new Error('This account does not have a Studio profile yet.');
  }

  currentOperator = operator;
  return { user, operator };
}

async function ensureHubAccess(email) {
  const { data, error } = await supabaseAuth.rpc('get_operator_access', {
    candidate_email: email,
  });

  if (error) throw new Error(error.message);
  if (!data?.membership_active && !data?.is_admin) {
    throw new Error('The Members Hub is only for active Studio subscribers right now.');
  }
}

async function loadRooms() {
  const { data, error } = await supabaseAuth
    .from('hub_rooms')
    .select('slug, title, description, sort_order')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  roomCache = data || [];
  renderRoomList();
}

async function loadProfile() {
  const { data, error } = await supabaseAuth
    .from('hub_member_profiles')
    .select('nickname, last_nickname_change_at')
    .eq('operator_id', currentOperator.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  currentProfile = data;

  if (!currentProfile) {
    nicknameModal.hidden = false;
    nicknameInput.focus();
    return;
  }

  nicknameModal.hidden = true;
  nicknamePill.textContent = currentProfile.nickname;
}

function setupRealtime() {
  if (messageSubscription) supabaseAuth.removeChannel(messageSubscription);
  if (resourceSubscription) supabaseAuth.removeChannel(resourceSubscription);

  messageSubscription = supabaseAuth
    .channel('hub-messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_messages' }, () => {
      loadMessages().catch(console.error);
    })
    .subscribe();

  resourceSubscription = supabaseAuth
    .channel('hub-resources')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_resources' }, () => {
      loadResources().catch(console.error);
    })
    .subscribe();
}

async function reportMessage(messageId) {
  const reason = window.prompt('Optional: tell us why you are reporting this message.') || '';
  const { error } = await supabaseAuth.from('hub_message_reports').insert({
    message_id: messageId,
    reporter_operator_id: currentOperator.id,
    reason,
  });

  if (error) {
    showError(error.message);
    return;
  }

  showInfo('Message reported.');
}

async function reportResource(resourceId) {
  const reason = window.prompt('Optional: tell us why you are reporting this resource.') || '';
  const { error } = await supabaseAuth.from('hub_resource_reports').insert({
    resource_id: resourceId,
    reporter_operator_id: currentOperator.id,
    reason,
  });

  if (error) {
    showError(error.message);
    return;
  }

  showInfo('Resource reported.');
}

async function editResource(resourceId) {
  const { data: existing, error } = await supabaseAuth
    .from('hub_resources')
    .select('id, title, description')
    .eq('id', resourceId)
    .eq('operator_id', currentOperator.id)
    .maybeSingle();

  if (error || !existing) {
    showError('That resource could not be loaded for editing.');
    return;
  }

  const nextTitle = window.prompt('Edit the title', existing.title);
  if (!nextTitle) return;
  const nextDescription = window.prompt('Edit the description', existing.description || '') ?? '';

  const { error: updateError } = await supabaseAuth
    .from('hub_resources')
    .update({
      title: nextTitle.trim(),
      description: nextDescription.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', resourceId)
    .eq('operator_id', currentOperator.id);

  if (updateError) {
    showError(updateError.message);
    return;
  }

  await loadResources();
}

async function deleteResource(resourceId) {
  const confirmed = window.confirm('Delete this resource?');
  if (!confirmed) return;

  const { error } = await supabaseAuth
    .from('hub_resources')
    .update({
      is_removed: true,
      removed_at: new Date().toISOString(),
      removed_by_operator_id: currentOperator.id,
    })
    .eq('id', resourceId)
    .eq('operator_id', currentOperator.id);

  if (error) {
    showError(error.message);
    return;
  }

  await loadResources();
}

async function sendHubWelcomeEmail(nickname) {
  try {
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();
    await fetch('/.netlify/functions/send-hub-welcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
      },
      body: JSON.stringify({ nickname }),
    });
  } catch (error) {
    console.warn('[members] welcome email failed', error);
  }
}

async function saveNickname(event) {
  event.preventDefault();
  nicknameError.hidden = true;
  nicknameError.textContent = '';
  const nickname = nicknameInput.value.trim();
  if (!nickname) return;

  if (currentProfile?.last_nickname_change_at) {
    const nextAllowed = new Date(currentProfile.last_nickname_change_at);
    nextAllowed.setDate(nextAllowed.getDate() + 30);
    if (currentProfile.nickname && new Date() < nextAllowed && currentProfile.nickname !== nickname) {
      nicknameError.hidden = false;
      nicknameError.textContent = `You can change your nickname again after ${nextAllowed.toLocaleDateString('en-AU')}.`;
      return;
    }
  }

  const payload = {
    operator_id: currentOperator.id,
    nickname,
    last_nickname_change_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = currentProfile
    ? await supabaseAuth
        .from('hub_member_profiles')
        .update(payload)
        .eq('operator_id', currentOperator.id)
    : await supabaseAuth.from('hub_member_profiles').insert({
        ...payload,
        created_at: new Date().toISOString(),
      });

  if (error) {
    nicknameError.hidden = false;
    nicknameError.textContent = error.message.includes('duplicate')
      ? 'That nickname is taken already.'
      : error.message;
    return;
  }

  const isFirstTime = !currentProfile;
  currentProfile = {
    nickname,
    last_nickname_change_at: payload.last_nickname_change_at,
  };
  nicknamePill.textContent = nickname;
  nicknameModal.hidden = true;
  showInfo(isFirstTime ? 'Nickname saved. Welcome in.' : 'Nickname updated.');

  if (isFirstTime) {
    await sendHubWelcomeEmail(nickname);
  }

  await loadMessages();
  await loadResources();
}

async function handleLogin(event) {
  event.preventDefault();
  clearError();
  clearInfo();
  setBusy(loginButton, 'Checking access...');
  const email = document.getElementById('hubEmail').value.trim().toLowerCase();
  const password = document.getElementById('hubPassword').value;

  try {
    const { error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await bootstrapMemberApp();
  } catch (error) {
    showError(error.message || 'Could not sign you in.');
    resetBusy(loginButton);
  }
}

async function bootstrapMemberApp() {
  clearError();
  clearInfo();

  const {
    data: { session },
  } = await supabaseAuth.auth.getSession();
  if (!session?.user?.email) {
    gate.hidden = false;
    app.hidden = true;
    resetBusy(loginButton);
    return;
  }

  currentSession = session;
  const { user, operator } = await ensureOperator();
  await ensureHubAccess(user.email);
  await loadRooms();
  await loadProfile();
  await loadMessages();
  await loadResources();
  setupRealtime();

  gate.hidden = true;
  app.hidden = false;
  membersGateCopy.textContent = 'Sign in with the same email you use for Studio. If your Studio subscription is active, the Hub will let you straight in.';
  resetBusy(loginButton);
}

messageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  const body = messageInput.value.trim();
  if (!body) return;

  if (currentRoomSlug === 'promo-support') {
    const { count, error } = await supabaseAuth
      .from('hub_messages')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', currentOperator.id)
      .eq('room_slug', 'promo-support')
      .gte('created_at', startOfTodayIso());

    if (error) {
      showError(error.message);
      return;
    }

    if ((count || 0) >= 1) {
      showError('Promo Support is one promo post per member per day.');
      return;
    }
  }

  setBusy(messageSubmit, 'Sending...');
  const { error } = await supabaseAuth.from('hub_messages').insert({
    operator_id: currentOperator.id,
    display_name: currentProfile?.nickname || 'Member',
    author_nickname: currentProfile?.nickname || 'Member',
    room_slug: currentRoomSlug,
    message_body: body,
  });

  if (error) {
    showError(error.message);
    resetBusy(messageSubmit);
    return;
  }

  messageInput.value = '';
  resetBusy(messageSubmit);
});

resourceType.addEventListener('change', () => {
  const isFile = resourceType.value === 'file';
  resourceLinkWrap.hidden = isFile;
  resourceFileWrap.hidden = !isFile;
  resourceUrl.required = !isFile;
  resourceFile.required = isFile;
});

resourceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  clearInfo();
  setBusy(resourceSubmit, 'Sharing...');

  const title = document.getElementById('resourceTitle').value.trim();
  const category = document.getElementById('resourceCategory').value;
  const type = resourceType.value;
  const description = document.getElementById('resourceDescription').value.trim();

  if (!title) {
    showError('Give the resource a clear title first.');
    resetBusy(resourceSubmit);
    return;
  }

  let externalUrl = null;
  let filePath = null;
  let preview = {};

  try {
    if (type === 'link') {
      externalUrl = resourceUrl.value.trim();
      if (!externalUrl) {
        throw new Error('Paste the link you want to share.');
      }

      try {
        const previewRes = await fetch(`/.netlify/functions/link-preview?url=${encodeURIComponent(externalUrl)}`);
        if (previewRes.ok) {
          const previewPayload = await previewRes.json();
          preview = {
            preview_title: previewPayload.title || null,
            preview_description: previewPayload.description || null,
            preview_image_url: previewPayload.image || null,
          };
        }
      } catch (previewError) {
        console.warn('[members] link preview failed', previewError);
      }
    } else {
      const file = resourceFile.files?.[0];
      if (!file) {
        throw new Error('Choose the file you want to share.');
      }

      const objectPath = `${currentOperator.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabaseAuth.storage.from('hub-resources').upload(objectPath, file, {
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabaseAuth.storage.from('hub-resources').getPublicUrl(objectPath);
      filePath = data.publicUrl;
    }

    const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabaseAuth.from('hub_resources').insert({
      title,
      slug,
      short_description: description || title,
      description,
      category,
      resource_type: type,
      operator_id: currentOperator.id,
      uploader_nickname: currentProfile?.nickname || 'Member',
      external_url: externalUrl,
      file_path: filePath,
      is_published: true,
      ...preview,
    });

    if (error) throw error;

    resourceForm.reset();
    resourceLinkWrap.hidden = false;
    resourceFileWrap.hidden = true;
    showInfo('Resource shared.');
    resetBusy(resourceSubmit);
    await loadResources();
  } catch (error) {
    showError(error.message || 'That resource could not be shared right now.');
    resetBusy(resourceSubmit);
  }
});

signOutButton.addEventListener('click', async () => {
  await supabaseAuth.auth.signOut();
  gate.hidden = false;
  app.hidden = true;
  currentSession = null;
  currentOperator = null;
  currentProfile = null;
  roomCache = [];
});

changeNicknameButton.addEventListener('click', () => {
  nicknameError.hidden = true;
  nicknameError.textContent = '';
  nicknameInput.value = currentProfile?.nickname || '';
  nicknameModal.hidden = false;
});

nicknameForm.addEventListener('submit', saveNickname);
document.querySelectorAll('.members-segment').forEach((button) => {
  button.addEventListener('click', () => setSection(button.dataset.section));
});

supabaseAuth.auth.onAuthStateChange((_event, session) => {
  currentSession = session;
});

bootstrapMemberApp().catch((error) => {
  if (error.message?.includes('active Studio subscribers')) {
    gate.hidden = false;
    app.hidden = true;
    membersGateCopy.textContent = error.message;
    showInfo('The public Hub page stays open to everyone, but the real Hub is subscriber-only.');
    return;
  }

  console.warn('[members] bootstrap failed', error);
});
