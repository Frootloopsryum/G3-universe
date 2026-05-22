const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('[functions] STRIPE_SECRET_KEY is missing.');
}

const stripe = new Stripe(stripeSecretKey || 'sk_test_missing');

module.exports = { stripe };
