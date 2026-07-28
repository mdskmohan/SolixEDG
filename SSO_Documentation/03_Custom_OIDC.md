# Solix EDG — Custom OIDC SSO

Use **Custom OIDC** to connect any OpenID Connect–compliant identity provider that isn't Entra or Okta — for example Keycloak, Ping Identity, ForgeRock, Auth0, Google Workspace, or an internal provider.

> Read [Overview](00_Overview.md) and [Team & Role Provisioning](05_Team_and_Role_Provisioning.md) first. It is the same OIDC engine used by the Entra and Okta presets — the only difference is that nothing is pre-filled for you.

---

## What to do in your provider (before EDG)

1. **Create an application / client** of type **Confidential** (a web application that can hold a secret).
2. **Redirect URI:** set it to EDG's **Callback URL** (Settings → SSO → Generic OpenID Connect; read-only, `https://<your-edg>/callback`).
3. Copy the **Client ID** and **Client Secret**.
4. Find your provider's **Issuer / Authority URL** and confirm it publishes a discovery document at:
   `<issuer>/.well-known/openid-configuration`
5. Request the **`groups`** scope/claim (or your provider's equivalent) so EDG can assign teams. Confirm the group values it emits are **names** or **IDs** — you'll use whichever appears in the EDG rulebook.

### Common issuers

| Provider | Issuer / Authority |
|---|---|
| Keycloak | `https://<host>/realms/<realm>` |
| Ping Identity | `https://<host>` |
| Auth0 | `https://<tenant>.auth0.com/` |
| Google Workspace | `https://accounts.google.com` |

---

## Values to copy into EDG

| Provider value | EDG field |
|---|---|
| Client ID | **Client ID** |
| Client Secret | **Client Secret** |
| `<issuer>/.well-known/openid-configuration` | **Discovery URI** |
| EDG's own read-only value | **Callback URL** (auto — register it in your provider) |

---

## EDG field reference

### Connection

- **Client ID** — *Definition:* the OAuth2 client identifier from your provider. *Why it matters:* identifies EDG to the provider.
- **Client Secret** — *Definition:* the OAuth2 client secret. *Note:* keep it secure; never expose it client-side.
- **Discovery URI** — *Definition:* your provider's OpenID metadata endpoint. *Why it matters:* EDG discovers all endpoints and signing keys from it. *Note:* must be reachable from EDG and return a valid discovery document.
- **Callback URL** — *Definition:* where the provider returns the user after login. *Note:* read-only, auto-generated; must be registered in your provider.

### Advanced (recommended defaults)

- **Scope** — default `openid email profile`; add `groups` for team assignment.
- **Public Key URLs** — usually auto-discovered from the discovery document; set manually only if your provider doesn't publish a JWKS URI.
- **Response Type / Preferred JWS Algorithm / Client Auth Method** — protocol defaults (`code`, `RS256`, `client_secret_post`); change only to match your provider.
- **Disable PKCE / Use Nonce** — leave PKCE **on** (Disable PKCE off) unless your provider requires otherwise.
- **Max Clock Skew / Custom Params** — tune only if you hit token time-validation issues or your provider needs extra request parameters.

### Shared — Identity, teams & roles

See [Team & Role Provisioning](05_Team_and_Role_Provisioning.md) for principal claims, admins, the group→team→role rulebook, and self-signup behaviour.
