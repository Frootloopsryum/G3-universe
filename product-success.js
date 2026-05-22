import { escapeHtml, queryParam } from './catalog-common.js';

const shell = document.getElementById('productSuccessShell');

function renderError(message) {
  shell.innerHTML = `
    <div class="success-detail-card reveal visible">
      <p class="kicker">Hold up</p>
      <h1>That checkout could not be confirmed</h1>
      <p>${escapeHtml(message)}</p>
      <div class="hero-actions">
        <a class="button button-primary magnetic" href="products.html">Back to products</a>
      </div>
    </div>
  `;
}

async function init() {
  const sessionId = queryParam('session_id');
  if (!sessionId) {
    renderError('That success link is missing its checkout session.');
    return;
  }

  const response = await fetch(`/.netlify/functions/complete-product-order?session_id=${encodeURIComponent(sessionId)}`);
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    renderError(payload.error || 'We could not confirm your purchase.');
    return;
  }

  shell.innerHTML = `
    <div class="success-detail-card reveal visible">
      <p class="kicker">Purchase complete</p>
      <h1>${escapeHtml(payload.product.title)}</h1>
      <p>${escapeHtml(payload.product.shortDescription || 'Your file is ready.')}</p>
      <div class="success-detail-list">
        <div><strong>Delivery</strong><span>Instant download on this page and permanent link by email.</span></div>
        ${payload.customerEmail ? `<div><strong>Email sent to</strong><span>${escapeHtml(payload.customerEmail)}</span></div>` : ''}
      </div>
      <div class="hero-actions">
        ${
          payload.downloadUrl
            ? `<a class="button button-primary magnetic" href="${escapeHtml(payload.downloadUrl)}" target="_blank" rel="noopener">Open your PDF</a>`
            : ''
        }
        <a class="button button-ghost" href="products.html">Back to products</a>
      </div>
    </div>
  `;
}

init().catch((error) => {
  console.error('[product-success] failed to load', error);
  renderError('We could not confirm your purchase right now.');
});
