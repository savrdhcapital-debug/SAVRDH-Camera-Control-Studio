# Camera Studio database and administrator access

Target: https://ldfbrwcdebwoypthdqko.supabase.co

Apply camera-studio.sql, then camera-studio-auth.sql. The first creates an isolated
Camera Studio state table. The second restricts it to users explicitly listed in
camera_studio_admins. TV OS tables and platform_admins memberships are unchanged.
Do not grant Camera membership to ordinary TV users. Add administrator memberships
through trusted Supabase database administration only, never from the browser app.

Camera Studio uses the publishable key and the signed-in administrator's access
token, not a service role key. RLS checks Camera membership for reads and writes.
Removing membership or disabling it revokes Camera access on subsequent requests.
Email/password authentication uses Supabase Auth; passwords are not stored here.
Auth verifies the token and membership on every privileged server request.

The existing record structure is stored as a versioned JSON document. Writes
compare revision and retry conflicts across server instances. Database failures
never fall back to local files. Existing local records are not automatically
imported. Draft plans/models initialize on the first write; no customers are seeded.

Set CAMERA_SUPABASE_URL, CAMERA_SUPABASE_PUBLISHABLE_KEY, CAMERA_ADMIN_ORIGIN
(exact HTTPS origin, no trailing slash), and CAMERA_ADMIN_SESSION_SECRET (random,
32+ characters) in the Camera Studio Vercel project's production environment.
There is no default password. Use the password set for the approved Supabase user.
Sessions require sign-in again after one hour or token expiry, whichever is sooner.
Access tokens remain inside the encrypted HttpOnly secure session cookie.

Local installs without Supabase variables retain the original access-key login
and local storage. data/admin-access.txt is only for that local mode.

Verify login, create a real record, reload and confirm persistence. Also test a
signed-in non-Camera user: membership and records must be inaccessible.
