const { ok, badRequest, serverError, handleOptions } = require('./lib/http');

function extractMeta(html, attrName, attrValue) {
  const regex = new RegExp(
    `<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  return html.match(regex)?.[1] || null;
}

function extractTitle(html) {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || null;
}

exports.handler = async (event) => {
  const optionsResponse = handleOptions(event.httpMethod);
  if (optionsResponse) return optionsResponse;

  if (event.httpMethod !== 'GET') return badRequest('GET only');

  try {
    const url = event.queryStringParameters?.url;
    if (!url) return badRequest('Missing url.');

    const target = new URL(url);
    if (!/^https?:$/i.test(target.protocol)) return badRequest('Only http and https URLs are supported.');

    const response = await fetch(target.toString(), {
      headers: { 'User-Agent': 'G3UniverseLinkPreview/1.0' },
    });

    if (!response.ok) {
      return badRequest('That link could not be previewed.');
    }

    const html = await response.text();
    const preview = {
      title:
        extractMeta(html, 'property', 'og:title') ||
        extractMeta(html, 'name', 'twitter:title') ||
        extractTitle(html),
      description:
        extractMeta(html, 'property', 'og:description') ||
        extractMeta(html, 'name', 'description') ||
        extractMeta(html, 'name', 'twitter:description'),
      image:
        extractMeta(html, 'property', 'og:image') ||
        extractMeta(html, 'name', 'twitter:image'),
      siteName: extractMeta(html, 'property', 'og:site_name') || target.hostname,
      url: target.toString(),
    };

    return ok(preview);
  } catch (error) {
    console.error('[link-preview] failed', error);
    return serverError('That link preview could not be loaded right now.');
  }
};
