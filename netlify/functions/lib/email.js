const sgMail = require('@sendgrid/mail');

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;

if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.warn('[functions] SENDGRID_API_KEY is missing.');
}

async function sendEmail({ to, subject, html }) {
  if (!sendgridApiKey || !fromEmail || !to) {
    console.warn('[functions] Email skipped because SendGrid config or recipient is missing.');
    return { skipped: true };
  }

  await sgMail.send({
    to,
    from: fromEmail,
    subject,
    html,
  });

  return { sent: true };
}

function productEmailHtml({ title, downloadUrl }) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your G3 download</title>
    </head>
    <body style="margin:0;padding:24px;background:#090909;color:#ffffff;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#121212;border:1px solid #2a2a2a;border-radius:20px;padding:28px;">
        <div style="font-size:30px;font-weight:900;letter-spacing:-1px;margin-bottom:12px;">G3.</div>
        <h1 style="font-size:24px;margin:0 0 12px;">Your file is ready</h1>
        <p style="font-size:15px;line-height:1.6;color:#c7c7c7;margin:0 0 20px;">
          Thanks for your purchase. Your download link for <strong style="color:#ffffff;">${title}</strong> is below and it does not expire.
        </p>
        <a href="${downloadUrl}" style="display:inline-block;background:#8cff00;color:#0a0a0a;font-weight:800;text-decoration:none;padding:14px 20px;border-radius:12px;">Open your download</a>
        <p style="font-size:13px;line-height:1.6;color:#8f8f8f;margin:20px 0 0;">
          Keep this email. You can come back to the same link any time.
        </p>
      </div>
    </body>
  </html>`;
}

function serviceEmailHtml({
  serviceTitle,
  customerName,
  depositAmount,
  balanceDue,
  preferredContactMethod,
  preferredCallTime,
  inquiryMessage,
}) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your G3 service booking</title>
    </head>
    <body style="margin:0;padding:24px;background:#090909;color:#ffffff;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#121212;border:1px solid #2a2a2a;border-radius:20px;padding:28px;">
        <div style="font-size:30px;font-weight:900;letter-spacing:-1px;margin-bottom:12px;">G3.</div>
        <h1 style="font-size:24px;margin:0 0 12px;">We got your enquiry</h1>
        <p style="font-size:15px;line-height:1.6;color:#c7c7c7;margin:0 0 20px;">
          Thanks ${customerName}. Your deposit for <strong style="color:#ffffff;">${serviceTitle}</strong> has been received.
        </p>
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
          <tr><td style="padding:10px 0;color:#8f8f8f;">Deposit paid</td><td style="padding:10px 0;text-align:right;font-weight:700;">$${depositAmount.toFixed(2)} AUD</td></tr>
          <tr><td style="padding:10px 0;color:#8f8f8f;">Balance due on delivery</td><td style="padding:10px 0;text-align:right;font-weight:700;">$${balanceDue.toFixed(2)} AUD</td></tr>
          <tr><td style="padding:10px 0;color:#8f8f8f;">Preferred contact</td><td style="padding:10px 0;text-align:right;font-weight:700;">${preferredContactMethod || 'Any'}</td></tr>
          ${
            preferredCallTime
              ? `<tr><td style="padding:10px 0;color:#8f8f8f;">Preferred call time</td><td style="padding:10px 0;text-align:right;font-weight:700;">${preferredCallTime}</td></tr>`
              : ''
          }
        </table>
        ${
          inquiryMessage
            ? `<div style="background:#0d0d0d;border:1px solid #232323;border-radius:14px;padding:16px;">
                <div style="font-size:12px;color:#8f8f8f;margin-bottom:8px;font-weight:700;">YOUR MESSAGE</div>
                <div style="font-size:14px;line-height:1.6;color:#ffffff;white-space:pre-line;">${inquiryMessage}</div>
              </div>`
            : ''
        }
        <p style="font-size:13px;line-height:1.6;color:#8f8f8f;margin:20px 0 0;">
          We'll be in touch with next steps.
        </p>
      </div>
    </body>
  </html>`;
}

function hubWelcomeEmailHtml({ nickname, hubUrl }) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Welcome to the Members Hub</title>
    </head>
    <body style="margin:0;padding:24px;background:#090909;color:#ffffff;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#121212;border:1px solid #2a2a2a;border-radius:20px;padding:28px;">
        <div style="font-size:30px;font-weight:900;letter-spacing:-1px;margin-bottom:12px;">G3.</div>
        <h1 style="font-size:24px;margin:0 0 12px;">Welcome to the Members Hub</h1>
        <p style="font-size:15px;line-height:1.6;color:#c7c7c7;margin:0 0 20px;">
          You're in. Your Hub nickname is <strong style="color:#ffffff;">${nickname}</strong>.
        </p>
        <p style="font-size:15px;line-height:1.6;color:#c7c7c7;margin:0 0 20px;">
          Jump into chat, share a resource, ask a question, or lurk quietly until the chaos feels familiar.
        </p>
        <a href="${hubUrl}" style="display:inline-block;background:#8cff00;color:#0a0a0a;font-weight:800;text-decoration:none;padding:14px 20px;border-radius:12px;">Open the Hub</a>
      </div>
    </body>
  </html>`;
}

module.exports = {
  sendEmail,
  productEmailHtml,
  serviceEmailHtml,
  hubWelcomeEmailHtml,
};
