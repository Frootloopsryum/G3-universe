const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('[functions] STRIPE_SECRET_KEY is missing.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

module.exports = { stripe };
