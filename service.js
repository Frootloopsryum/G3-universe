import { getSupabasePublic } from './supabase-public.js';
import {
  escapeHtml,
  normalizeBullets,
  priceLabel,
  queryParam,
  setBusy,
  resetBusy,
  scrollToElement,
} from './catalog-common.js';

const shell = document.getElementById('serviceDetailShell');
const errorBox = document.getElementById('serviceDetailError');

function showError(message) {
  if (errorBox) {
    errorBox.hidden = false;
    errorBox.textContent = message;
  }
}

function renderService(service) {
  const bullets = normalizeBullets(service.bullet_points);
  const price = priceLabel(service.price_aud);
  const depositPercent = Number(service.deposit_percent || 50);

  shell.innerHTML = `
    <section class="page-hero service-detail-hero">
      <div class="container detail-grid detail-grid-service">
        <div class="detail-copy reveal visible">
          <p class="eyebrow"><span></span> Service</p>
          <h1>${escapeHtml(service.title)}</h1>
          <p class="detail-lead">${escapeHtml(service.short_description)}</p>
          ${price ? `<p class="detail-price">${escapeHtml(price)}</p>` : ''}
          <div class="detail-actions">
            <button id="startInquiryButton" class="button button-primary magnetic" type="button">Start enquiry</button>
            <a class="button button-ghost" href="services.html">Back to services</a>
          </div>
        </div>
        <article class="detail-panel reveal visible ${service.theme === 'pink' ? 'theme-pink' : 'theme-green'}">
          <div class="product-status">${escapeHtml(service.status_label || 'Available')}</div>
          ${
            service.long_description
              ? `<p class="detail-panel-copy">${escapeHtml(service.long_description)}</p>`
              : ''
          }
          ${
            bullets.length
              ? `<ul class="detail-bullets">${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>`
              : ''
          }
          <div class="detail-note">
            <strong>How payment works</strong>
            <span>${depositPercent}% is paid at checkout. The remaining balance is paid once the service is delivered.</span>
          </div>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="container detail-form-wrap">
        <article class="detail-form-card reveal visible" id="serviceInquiryCard">
          <div class="form-header">
            <div>
              <p>Tell us what you need</p>
              <span>${escapeHtml(service.title)}</span>
            </div>
          </div>
          <form id="serviceInquiryForm" class="service-intake-form">
            <div class="detail-form-grid">
              <div>
                <label for="firstName">First name</label>
                <input id="firstName" name="firstName" required />
              </div>
              <div>
                <label for="lastName">Last name</label>
                <input id="lastName" name="lastName" required />
              </div>
            </div>
            <div class="detail-form-grid">
              <div>
                <label for="email">Email</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div>
                <label for="phone">Phone</label>
                <input id="phone" name="phone" type="tel" required />
              </div>
            </div>
            <div>
              <label for="serviceSelection">Service</label>
              <select id="serviceSelection" name="serviceSelection" required>
                <option value="${escapeHtml(service.title)}">${escapeHtml(service.title)}</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label for="preferredContactMethod">Preferred contact method</label>
              <select id="preferredContactMethod" name="preferredContactMethod" required>
                <option value="">Choose one</option>
                <option value="Email">Email</option>
                <option value="SMS">SMS</option>
                <option value="Phone call">Phone call</option>
                <option value="Any">Any</option>
              </select>
            </div>
            <div id="preferredCallTimeWrap" hidden>
              <label for="preferredCallTime">Preferred call time</label>
              <input id="preferredCallTime" name="preferredCallTime" placeholder="Weekdays after 3pm, mornings, whenever" />
            </div>
            <div>
              <label for="inquiryMessage">Message</label>
              <textarea id="inquiryMessage" name="inquiryMessage" rows="6" placeholder="Tell us what you need, what is broken, what you are trying to build, or anything else useful."></textarea>
            </div>
            <div class="detail-note detail-note-tight">
              <strong>Before checkout</strong>
              <span>Checkout takes a ${depositPercent}% deposit now. The remaining balance is paid after delivery.</span>
            </div>
            <button id="serviceInquirySubmit" class="button button-primary magnetic" type="submit">Continue to deposit checkout</button>
          </form>
        </article>
      </div>
    </section>
  `;

  const startButton = document.getElementById('startInquiryButton');
  const inquiryCard = document.getElementById('serviceInquiryCard');
  const preferredContactMethod = document.getElementById('preferredContactMethod');
  const preferredCallTimeWrap = document.getElementById('preferredCallTimeWrap');
  const submitButton = document.getElementById('serviceInquirySubmit');
  const form = document.getElementById('serviceInquiryForm');

  startButton?.addEventListener('click', () => {
    scrollToElement(inquiryCard);
  });

  preferredContactMethod?.addEventListener('change', (event) => {
    const value = event.target.value;
    preferredCallTimeWrap.hidden = value !== 'Phone call';
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(submitButton, 'Opening checkout...');
    const formData = new FormData(form);
    const payload = {
      slug: service.slug,
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      serviceSelection: formData.get('serviceSelection'),
      preferredContactMethod: formData.get('preferredContactMethod'),
      preferredCallTime: formData.get('preferredCallTime'),
      inquiryMessage: formData.get('inquiryMessage'),
    };

    try {
      const response = await fetch('/.netlify/functions/create-service-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Checkout could not be opened right now.');
      }
      window.location.href = result.url;
    } catch (error) {
      showError(error.message || 'Checkout could not be opened right now.');
      resetBusy(submitButton);
    }
  });
}

async function init() {
  const slug = queryParam('slug');
  if (!slug) {
    showError('That service link is missing a slug.');
    return;
  }

  const supabasePublic = await getSupabasePublic();
  const { data, error } = await supabasePublic
    .from('public_service_offers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    showError('That service could not be found.');
    return;
  }

  renderService(data);
}

init().catch((error) => {
  console.error('[service] failed to load', error);
  showError('That service could not be loaded right now.');
});
