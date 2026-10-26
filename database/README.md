# Camera Studio database

Target: https://ldfbrwcdebwoypthdqko.supabase.co

Run camera-studio.sql once in the Supabase SQL Editor. This creates only
public.camera_studio_state, with row level security enabled and no anonymous or
signed-in browser access. It does not modify TV OS tables or share their records.
This is a separate application table in the same Supabase project, not a separate
Supabase project or independently credentialed database.

The existing admin record structure is persisted as a versioned JSON document.
Writes compare the revision and retry on conflicts to avoid losing concurrent
updates across server instances. Customers, plans, licenses, payments, models,
tickets, studio snapshots and audit entries remain together in that document.
No customer data is seeded. Plan/model defaults are saved on the first write.
Database errors never fall back to local files. Hosted deployments require the DB.
Local installations without database variables retain the original local storage.
Existing local records are not automatically imported.

Configure server-only environment variables from .env.example. Never use a
NEXT_PUBLIC_ prefix for the service role key, admin key hash or session secret.
Use the project service role key only on the trusted server. The key can access
other tables in the same project, so independent credentials require a separate
Supabase project or a dedicated scoped database role.

Hosted admin additionally requires CAMERA_ADMIN_ORIGIN, CAMERA_ADMIN_KEY_HASH and
CAMERA_ADMIN_SESSION_SECRET. There is no default login password. Local setup
creates data/admin-access.txt; the repository intentionally excludes that file.
The stored hash cannot be reversed to recover the private access key.

After configuration, verify login, create a real record, reload and confirm it
persists. Check that anonymous REST reads return no rows or permission denied.
