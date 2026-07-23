## Confirmed diagnosis

The screenshot matches the deployed server fallback, and fresh production logs still show `Disallowed operation called within global scope`.

The generated server bundle contains the browser Supabase client through the global auth-attacher middleware. During server rendering, that client is created with session persistence and automatic token refresh enabled. Supabase Auth starts a background refresh timer; when it runs outside an active request, the hosting runtime rejects it and returns the site-wide 500.

## Fix plan

1. **Make the auth attacher server-safe**
   - Guard its client middleware so server-rendered server-function calls do not instantiate the browser Supabase client or read a browser session.
   - Preserve the current browser behavior so authenticated client calls still receive their bearer token.

2. **Remove background initialization from server-side Supabase clients**
   - Ensure every Supabase client that can exist in the server runtime disables persistence, automatic refresh, and constructor-time background initialization.
   - Keep authentication checks request-scoped and explicitly awaited.

3. **Remove the ineffective chunk workaround**
   - Delete the `manualChunks` rules that merge all browser libraries into one chunk; they do not address the confirmed timer source and may create fragile bundle coupling.
   - Preserve the custom TanStack server entry and existing error capture.

4. **Verify the production artifact and routes**
   - Confirm the built server path cannot start the Supabase refresh timer.
   - Test `/`, `/discover`, `/library`, `/remote/test`, and `/favicon.ico` using the production server path.

5. **Publish and verify the live site**
   - Run the required security check, publish the corrected build, then re-test the Lovable URL and custom domain.
   - Confirm fresh production logs no longer contain `Disallowed operation called within global scope`.