# IP Allow and Private Networking across Neon services

IP Allow and Private Networking restrict **Postgres connections only**. They don't protect any other Neon service. Some services also stop working while either control is enabled.

Use this reference before you enable or build on Auth, Realtime, Functions, Object Storage, the AI Gateway, or the Data API in a project that might use IP Allow or Private Networking. Also use it whenever a user asks whether IP Allow or Private Networking protects one of these services.

## Support status by service

"Private Networking" here means a project that blocks public internet access (`block_public_connections: true`). Private Networking with public access still allowed changes nothing in this table.

| Service | Protected by IP Allow or Private Networking? | Works while either is enabled? |
| --- | --- | --- |
| Postgres connections (any driver, ORM, `psql`, `@neondatabase/serverless` over HTTP or WebSocket) | Yes | Yes, from allowed networks only |
| Data API | No. Requests from any network are served. | Yes |
| Realtime | No | No. Subscriptions fail to connect. |
| Managed Better Auth | No | No. Sign-in and other auth requests fail. |
| Functions: the function URL | No | Yes |
| Functions: connecting to Postgres with `DATABASE_URL` | n/a | No. Functions have no fixed outbound IP range to allowlist. |
| Object Storage | No | Yes. Access is controlled by credentials. |
| AI Gateway | No | Yes. Access is controlled by credentials. |

None of these services is supported on a project with IP Allow or Private Networking enabled, even where it keeps working. Never present IP Allow or Private Networking as protection for any of them.

## What to do

1. **Check the project before you enable a service.** Run `neon projects get <project_id> --output json` and read `settings.allowed_ips.ips` (IP Allow is on when the list is non-empty) and `settings.block_public_connections` (public access is blocked when `true`). `settings.allowed_ips.protected_branches_only: true` limits IP Allow to protected branches.
2. **If either control is on, tell the user before you continue.** Name the service and say what the table shows for it: whether it's protected and whether it will work. Let the user decide.
3. **Never turn off IP Allow or Private Networking to make a service work.** Leave those protections in place. Changing them is the user's call.
4. **Point to the real access control for each service:**
   - Data API: JWT authentication, `GRANT`s, and row-level security.
   - Object Storage and the AI Gateway: narrowly scoped credentials anchored to the right branch.
   - Function URLs: authenticate incoming requests in the handler.
5. **Expect a delay after a change.** IP Allow and Private Networking changes take a few minutes to reach every service. A service that still works right after the change isn't evidence that it's supported.

## Docs

- IP Allow and other Neon services: https://neon.com/docs/introduction/ip-allow.md
- Private Networking and other Neon services: https://neon.com/docs/guides/neon-private-networking.md
