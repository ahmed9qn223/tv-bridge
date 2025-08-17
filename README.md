# tv-bridge (reverse proxy)

Deploy to Render/Fly/any Node host.

Env: `UPSTREAM_ALLOW = ^https?://(dolive\.thaim3u\.com|keela2\.com)(/|$)`

After deploy, set in Cloudflare Worker Variables:
`BRIDGE_URL = https://<your-bridge-host>`
