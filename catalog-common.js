export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizeBullets(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  return [];
}

export function priceLabel(amount) {
  if (amount === null || amount === undefined || amount === '') return '';
  const numeric = Number(amount);
  if (Number.isNaN(numeric) || numeric <= 0) return '';
  return `$${numeric.toFixed(2)} AUD`;
}

export function queryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function setBusy(button, label) {
  if (!button) return;
  button.disabled = true;
  button.dataset.originalLabel = button.dataset.originalLabel || button.textContent || '';
  button.textContent = label;
}

export function resetBusy(button) {
  if (!button) return;
  button.disabled = false;
  button.textContent = button.dataset.originalLabel || button.textContent || '';
}

export function scrollToElement(target) {
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
