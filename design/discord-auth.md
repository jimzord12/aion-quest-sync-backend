Yes — and it's actually the perfect, clean solution to your onboarding question. Here is the full picture:

## Yes, You Can Gate Access by Guild Membership

Discord OAuth2 exposes a `guilds` scope that returns the list of all Discord servers the user belongs to. Your backend simply checks whether your Legion's Guild ID is in that list. If it is — access granted. If it isn't — rejected with a "You must be a member of the Legion Discord to use LegionSync" message. [stackoverflow](https://stackoverflow.com/questions/69501363/discord-api-view-guild-channels-information-with-oauth2-guilds-scope)

This means **no invite links, no manual approval, no admin whitelist**. Joining the Legion Discord server IS the access credential. Leave the server, lose access automatically on next login. Clean and self-maintaining.

## The Two-Scope Strategy

You actually want **two scopes** requested at OAuth login: [stackoverflow](https://stackoverflow.com/questions/69518877/discord-oauth2-getting-user-roles-from-exact-guild)

| Scope                              | What it gives you                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `identify`                         | User's Discord ID, username, avatar — enough to create their profile                                                 |
| `guilds`                           | List of all servers they're in — used to check Legion membership                                                     |
| `guilds.members.read` _(optional)_ | Their specific roles within your server — useful if you want to differentiate Legion Leader / Officer / Member later |

For your MVP, `identify` + `guilds` is enough. Add `guilds.members.read` later if you want to give Legion officers an admin panel.

## How the Auth Flow Works in Code

```
1. User clicks "Login with Discord"
2. Your app redirects to Discord OAuth with scopes: identify + guilds
3. User approves → Discord redirects back with a code
4. Backend exchanges code for access_token
5. Backend calls GET /users/@me → gets user profile (id, username, avatar)
6. Backend calls GET /users/@me/guilds → gets list of all their servers
7. Backend checks: is YOUR_LEGION_GUILD_ID in that list?
   ├── YES → create/update user in DB, issue your own JWT, let them in
   └── NO  → return 403 "Not a Legion member"
```

Your Legion's Guild ID is just a fixed env variable (`LEGION_GUILD_ID=123456789`). It never changes. [stackoverflow](https://stackoverflow.com/questions/69501363/discord-api-view-guild-channels-information-with-oauth2-guilds-scope)

## One Important Caveat

The `guilds` scope only runs at **login time**. If someone gets kicked from the Legion Discord _after_ they've already logged in, their existing JWT session remains valid until it expires. The practical fix:

- Set a short JWT expiry (e.g. 24 hours)
- Re-validate guild membership on each token refresh
- Or add a `/auth/validate` check on sensitive backend calls

For a small hobby app among friends, 24-hour expiry with re-validation on refresh is more than sufficient.

## Answer to the Open Question in the PRD

> **Invite / Onboarding**: Auto-approve anyone currently in the Legion Discord server.

The answer is: use Discord OAuth2 with the `guilds` scope and check for your Legion's Guild ID on every login. No invite system needed, no admin overhead. Zero friction — which aligns perfectly with your UX principles.
