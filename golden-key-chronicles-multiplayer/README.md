# The Golden Key Chronicles — multiplayer 3D starter

A browser-based Three.js + Colyseus multiplayer starter. The frontend runs in modern desktop and mobile browsers; the authoritative room server synchronizes movement, runes, world changes, room codes and victory.

## Included
- Five named explorer slots: Tom, Josh, Dave, Joe and Stone.
- Server-created room IDs and five-character room codes, plus shareable invitation URLs.
- Colyseus WebSocket state synchronization and server-authoritative key victory.
- Spectator assignment after victory; additional joiners are spectators.
- Five procedurally composed Three.js scenes, portal, rune objects and responsive touch controls.
- Vite frontend and Render/Netlify deployment configuration.

## Run locally
Requires Node.js 20+ (22 recommended) and npm.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The server listens on http://localhost:2567.

## Deploy
1. Push this folder to a GitHub repository.
2. Deploy the server using the included `render.yaml` (or create a Node web service with root `server`, build `npm install && npm run build`, start `npm start`). Set `CLIENT_ORIGIN` to your deployed frontend URL.
3. Deploy the `client` folder to Netlify. Build command `npm install && npm run build`, publish directory `dist`.
4. Set Netlify environment variables:
   - `VITE_SERVER_HTTP=https://YOUR-SERVER.onrender.com`
   - `VITE_SERVER_WS=wss://YOUR-SERVER.onrender.com`
5. Redeploy the frontend. Test create-room, join-room from a second device, movement and win/spectator transition.

## Important production hardening
This is an engineering starter, not a fully load-tested production service. Before public launch, add persistent room-code storage or a distributed room directory for multiple server instances, rate limiting, reconnect/session recovery, input throttling, server-side distance validation for rune pickups, moderation/abuse controls, observability, automated tests, and a paid always-on server if free-tier sleep/cold starts are unacceptable. For public rooms, enable TLS and restrict `CLIENT_ORIGIN` to the exact deployed domain.

The art is procedurally generated Three.js geometry rather than bespoke AAA assets. Replace the primitives with optimized GLTF/GLB models, PBR materials, baked lighting, sound design and level streaming for the intended premium visual finish.
