## Fix: enable Anonymous sign-ins in Supabase

The app already calls `supabase.auth.signInAnonymously()` correctly — the 422 `anonymous_provider_disabled` error is a project-level toggle in Supabase Auth, not a code bug. No code changes are needed.

### Steps for you

1. Open the Supabase Auth Providers page (link below).
2. Find **Anonymous Sign-Ins** in the provider list.
3. Toggle it **on** and save.
4. Reload the ZAP·LIVE preview — the stage will initialize without error.

### After it works

Once you confirm the stage loads, I'll continue with any remaining polish you want (pinch preset scrub, face-mesh overlay, or abandoned-session cleanup).

<presentation-actions>
<presentation-link href="https://supabase.com/dashboard/project/zmiwbfvsqqmlpdxanttp/auth/providers">Open Auth Providers</presentation-link>
</presentation-actions>
