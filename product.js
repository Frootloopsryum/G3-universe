import { getSupabasePublic } from './supabase-public.js';
import { escapeHtml, normalizeBullets, priceLabel, queryParam, setBusy, resetBusy } from './catalog-common.js';

const shell = document.getElementById('productDetailShell');
const errorBox = document.getElementById('productDetailError');

function showError(message) {
  if (errorBox) {
    errorBox.hidden = false;
    errorBox.textContent = message;
  }
}

function renderProduct(product) {
  const bullets = normalizeBullets(product.bullet_points);
  const price = priceLabel(product.price_aud);
  const isBuyable = Boolean(product.price_aud && Number(product.price_aud) > 0);

  shell.innerHTML = `
    <section class="page-hero product-detail-hero">
      <div class="container detail-grid">
        <div class="detail-copy reveal visible">
          <p class="eyebrow"><span></span> Digital product</p>
          <h1>${escapeHtml(product.title)}</h1>
          <p class="detail-lead">${escapeHtml(product.short_description)}</p>
          ${price ? `<p class="detail-price">${escapeHtml(price)}</p>` : ''}
          <div class="detail-actions">
            ${
              isBuyable
                ? `<button id="buyProductButton" class="button button-primary magnetic" type="button">Buy now</button>`
                : `<a class="button button-primary magnetic" href="waitlist.html">Join the Waitlist</a>`
            }
            <a class="button button-ghost" href="products.html">Back to products</a>
          </div>
        </div>
        <article class="detail-panel reveal visible ${product.theme === 'pink' ? 'theme-pink' : 'theme-green'}">
          <div class="product-status">${escapeHtml(product.status_label || (isBuyable ? 'Available now' : 'Coming soon'))}</div>
          ${
            product.long_description
              ? `<p class="detail-panel-copy">${escapeHtml(product.long_description)}</p>`
              : ''
          }
          ${
            bullets.length
              ? `<ul class="detail-bullets">${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>`
              : ''
          }
          <div class="detail-note">
            <strong>How delivery works</strong>
            <span>You do not need an account. Pay once, open it straight away, and keep the link forever.</span>
          </div>
        </article>
      </div>
    </section>
  `;

  const button = document.getElementById('buyProductButton');
  if (button) {
    button.addEventListener('click', async () => {
      setBusy(button, 'Loading checkout...');
      try {
        const response = await fetch('/.netlify/functions/create-product-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: product.slug }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.url) {
          throw new Error(payload.error || 'Checkout could not be opened right now.');
        }
        window.location.href = payload.url;
      } catch (error) {
        showError(error.message || 'Checkout could not be opened right now.');
        resetBusy(button);
      }
    });
  }
}

async function init() {
  const slug = queryParam('slug');
  if (!slug) {
    showError('That product link is missing a slug.');
    return;
  }

  const supabasePublic = await getSupabasePublic();
  const { data, error } = await supabasePublic
    .from('public_store_products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    showError('That product could not be found.');
    return;
  }

  renderProduct(data);
}

init().catch((error) => {
  console.error('[product] failed to load', error);
  showError('That product could not be loaded right now.');
});
