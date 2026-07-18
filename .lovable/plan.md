## What's happening

The app signs users in anonymously on load (so sessions, takes, and RLS work without a full signup). Supabase rejects those calls until "Allow anonymous sign-ins" is turned on in the project's Auth settings — that's a dashboard toggle, not something code can flip.

## What to do

1. Open **Auth → Sign In / Providers** in your Supabase dashboard (link below).
2. Scroll to **User Signups** and enable **Allow anonymous sign-ins**.
3. Save, then reload the app preview — the anonymous session should mint successfully and the stage should load.

## Code changes

None. This is a one-time Supabase project setting. After you flip it, I'll verify the session mints and continue building.

<presentation-actions>
<presentation-link href="https://supabase.com/dashboard/project/zmiwbfvsqqmlpdxanttp/auth/providers">Open Supabase Auth providers</presentation-link>
</presentation-actions>
