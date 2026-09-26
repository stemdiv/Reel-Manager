# Google sign-in — checklist

When the app stops letting you sign in. IAM roles (Owner, etc.) are **not** involved: leave the IAM page alone.

Google Cloud Console, project **youtube-manager**:

1. **Client ID** — *APIs & Services → Credentials → OAuth 2.0 Client IDs*.
   Copy it back into the app if its setup screen asks for it again: "Delete my data" and the automatic purge after 30 days without signing in erase it.
2. **Authorized addresses** — same page, open the OAuth client:
   - *Authorized JavaScript origins*: `http://localhost:PORT` (the port you serve the app on).
   - *Authorized redirect URIs*: the page's full URL, e.g. `http://localhost:8080/youtube-playlist-manager.html`.
   A new port or path gives `redirect_uri_mismatch`.
3. **Test users** — *Google Auth Platform → Audience*. While the app is in *Testing*, add your Google account under *Test users*, or Google answers "Access blocked" / 403 `access_denied`.
4. **YouTube Data API v3 enabled** — *APIs & Services → Enabled APIs*.

In the app: sign in and come back **in the same tab** (otherwise the sign-in is refused), and reload with Ctrl+Shift+R if an old cached version is running.
