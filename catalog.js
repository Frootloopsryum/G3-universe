import { supabasePublic } from './supabase-public.js';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeBullets(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [];
}

function priceLabel(amount) {
  if (amount === null || amount === undefined || amount === '') return '';

  const numeric = Number(amount);
  if (Number.isNaN(numeric) || numeric <= 0) return '';
  return `$${numeric.toFixed(2)} AUD`;
}

function productCardMarkup(item, index) {
  const theme = item.theme === 'pink' ? 'theme-pink' : index % 2 === 0 ? 'theme-green' : 'theme-pink';
  const bullets = normalizeBullets(item.bullet_points);
  const ctaHref = item.cta_url || 'waitlist.html';
  const ctaLabel = item.cta_label || (item.stripe_price_id ? 'Buy now' : 'Notify me');
  const status = item.status_label || (item.stripe_price_id ? 'Available now' : 'Coming soon');
  const price = priceLabel(item.price_aud);

  return `
    <article class="product-card ${theme} reveal">
      <div class="product-status">${escapeHtml(status)}</div>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.short_description)}</p>
      ${price ? `<p class="product-price">${escapeHtml(price)}</p>` : ''}
      ${
        bullets.length
          ? `<ul class="product-card-bullets">${bullets
              .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
              .join('')}</ul>`
          : ''
      }
      <a class="button button-ghost" href="${escapeHtml(ctaHref)}">${escapeHtml(ctaLabel)}</a>
    </article>
  `;
}

function serviceCardMarkup(item, index) {
  const theme = item.theme === 'pink' ? 'theme-pink' : index % 2 === 0 ? 'theme-green' : 'theme-pink';
  const bullets = normalizeBullets(item.bullet_points);
  const ctaHref = item.cta_url || 'waitlist.html';
  const ctaLabel = item.cta_label || (item.requires_intake ? 'Apply now' : 'Enquire');
  const status = item.status_label || 'Waitlist';
  const price = priceLabel(item.price_aud);

  return `
    <article class="service-block ${theme} reveal">
      <span class="service-number">${String(index + 1).padStart(2, '0')}</span>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.short_description)}</p>
      ${price ? `<p class="service-price">${escapeHtml(price)}</p>` : ''}
      ${
        bullets.length
          ? `<ul>${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>`
          : ''
      }
      <div class="service-meta-row">
        <span class="service-meta-pill">${escapeHtml(status)}</span>
        <a class="button button-ghost" href="${escapeHtml(ctaHref)}">${escapeHtml(ctaLabel)}</a>
      </div>
    </article>
  `;
}

async function renderProductCatalog() {
  const container = document.getElementById('productCatalog');
  if (!container) return;

  try {
    const { data, error } = await supabasePublic
      .from('public_store_products')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) return;
    container.innerHTML = data.map(productCardMarkup).join('');
  } catch (error) {
    console.warn('[catalog] product catalog fallback retained', error);
  }
}

async function renderServiceCatalog() {
  const container = document.getElementById('serviceCatalog');
  if (!container) return;

  try {
    const { data, error } = await supabasePublic
      .from('public_service_offers')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) return;
    container.innerHTML = data.map(serviceCardMarkup).join('');
  } catch (error) {
    console.warn('[catalog] service catalog fallback retained', error);
  }
}

renderProductCatalog();
renderServiceCatalog();
