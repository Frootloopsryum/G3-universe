# G3 Universe

Static Netlify site for the G3 Universe brand and member portal.

## Important pages

- `index.html` - marketing homepage
- `products.html` - digital products
- `services.html` - services
- `hub.html` - members hub
- `studio.html` - operator portal sign-in / launch page
- `workspace.html` - embedded operator workspace shell
- `waitlist.html` - Netlify form waitlist
- `success.html` - waitlist success page

## Studio integration

The operator workspace itself lives in the separate `G3` app deployment and is expected to be available at:

- `https://studio.g3universe.com/`

`portal.js` signs operators into Supabase using the same credentials as the operator app, then:

- launches the full-screen studio app, or
- loads the same app inside `workspace.html`

## Netlify notes

- Publish directory: project root
- `netlify.toml` provides clean routes like `/studio` and `/workspace`
- Waitlist form is already Netlify-ready
