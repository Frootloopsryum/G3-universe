import { escapeHtml, queryParam } from './catalog-common.js';

const shell = document.getElementById('serviceSuccessShell');

function renderError(message) {
  shell.innerHTML = `
    <div class="success-detail-card reveal visible">
      <p class="kicker">Hold up</p>
      <h1>That checkout could not be confirmed</h1>
      <p>${escapeHtml(message)}</p>
      <div class="hero-actions">
        <a class="button button-primary magnetic" href="services.html">Back to services</a>
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

  const response = await fetch(`/.netlify/functions/complete-service-order?session_id=${encodeURIComponent(sessionId)}`);
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    renderError(payload.error || 'We could not confirm your service deposit.');
    return;
  }

  shell.innerHTML = `
    <div class="success-detail-card reveal visible">
      <p class="kicker">Deposit received</p>
      <h1>${escapeHtml(payload.service.title)}</h1>
      <p>${escapeHtml(payload.service.shortDescription || 'Your enquiry is in and we will be in touch.')}</p>
      <div class="success-detail-list">
        <div><strong>Deposit paid</strong><span>$${Number(payload.order.depositAmount || 0).toFixed(2)} AUD</span></div>
        <div><strong>Balance due after delivery</strong><span>$${Number(payload.order.balanceDue || 0).toFixed(2)} AUD</span></div>
        <div><strong>Preferred contact</strong><span>${escapeHtml(payload.order.preferredContactMethod || 'Any')}</span></div>
        ${
          payload.order.preferredCallTime
            ? `<div><strong>Preferred call time</strong><span>${escapeHtml(payload.order.preferredCallTime)}</span></div>`
            : ''
        }
      </div>
      ${
        payload.order.inquiryMessage
          ? `<div class="detail-note">
              <strong>Your message</strong>
              <span>${escapeHtml(payload.order.inquiryMessage)}</span>
            </div>`
          : ''
      }
      <div class="hero-actions">
        <a class="button button-primary magnetic" href="services.html">Back to services</a>
      </div>
    </div>
  `;
}

init().catch((error) => {
  console.error('[service-success] failed to load', error);
  renderError('We could not confirm your service deposit right now.');
});
