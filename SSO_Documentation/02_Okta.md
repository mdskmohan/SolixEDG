# Solix EDG — Okta SSO

Okta lets people sign in to Solix EDG with their Okta Workforce Identity accounts. Okta supports **both OIDC and SAML 2.0** — pick one. OIDC is recommended for new setups.

> Read [Overview](00_Overview.md) and [Team & Role Provisioning](05_Team_and_Role_Provisioning.md) first. Provisioning (teams, roles, self-signup) is the same for both protocols and is documented separately.

---

## Part A — Okta with OIDC

### What to do in Okta (before EDG)

1. **Okta Admin Console → Applications → Applications → Create App Integration.**
2. Choose **OIDC - OpenID Connect**, then **Web Application**. Next.
3. **Sign-in redirect URIs:** paste EDG's **Callback URL** (Settings → SSO → Okta → OIDC; read-only, `https://<your-edg>/callback`).
4. **Assignments:** assign the users or groups who may use EDG.
5. Save, then open the app's **General** tab: copy the **Client ID** and **Client secret**.
6. **Emit groups** (so EDG can assign teams): **Sign On** tab → **OpenID Connect ID Token** → set **Groups claim type = Filter**, claim name `groups`, filter **Matches regex** `.*` (or a tighter filter). Save.

### Values to copy into EDG

| Okta value | EDG field (OIDC) |
|---|---|
| Client ID | **Client ID** |
| Client secret | **Client Secret** |
| `https://<your-org>.okta.com/.well-known/openid-configuration` | **Discovery URI** |
| EDG's own read-only value | **Callback URL** (auto — paste into Okta step 3) |

> If you use a custom Okta Authorization Server, the discovery URI is `https://<your-org>.okta.com/oauth2/<authServerId>/.well-known/openid-configuration`.

---

## Part B — Okta with SAML

### What to do in Okta (before EDG)

1. **Applications → Create App Integration → SAML 2.0.** Next.
2. **General Settings:** name the app `Solix EDG`. Next.
3. **Configure SAML:**
   - **Single sign-on URL** = EDG's **ACS URL** (Settings → SSO → Okta → SAML; read-only). Keep *"Use this for Recipient URL and Destination URL"* checked.
   - **Audience URI (SP Entity ID)** = EDG's **SP Entity ID** (read-only).
   - **Name ID format** = **EmailAddress**; **Application username** = **Email**.
4. **Group Attribute Statements:** name `groups`, filter **Matches regex** `.*` (so EDG can assign teams).
5. Finish. On the app's **Sign On** tab → **View SAML setup instructions**: copy the **Identity Provider Issuer**, **Identity Provider Single Sign-On URL**, and the **X.509 Certificate**.
6. **Assignments:** assign users/groups.

### Values to copy into EDG

| Okta value | EDG field (SAML) |
|---|---|
| Identity Provider Issuer | **IdP Entity ID** |
| Identity Provider Single Sign-On URL | **IdP SSO Login URL** |
| X.509 Certificate | **IdP X.509 Certificate** |
| EDG's own read-only values | **SP Entity ID**, **ACS URL** (auto — paste into Okta step 3) |

---

## EDG field reference (Okta)

### OIDC — Connection

- **Client ID / Client Secret** — from the Okta app's General tab; identify and authenticate EDG to Okta.
- **Discovery URI** — Okta's OpenID metadata endpoint; EDG auto-discovers endpoints and signing keys from it.
- **Callback URL** — read-only, auto-generated; must match the Okta sign-in redirect URI exactly.

### OIDC — Advanced (recommended defaults)

- **Scope** — default `openid email profile`; add `groups` if you assign teams by group.
- **Client Auth Method** — default `client_secret_post`; must match the Okta app (Okta uses confidential/`client_secret_post` for web apps).
- **Disable PKCE / Use Nonce** — leave PKCE **on** (Disable PKCE off) unless engineering confirms otherwise.

### SAML

- **IdP Entity ID / IdP SSO Login URL / IdP X.509 Certificate** — the three values from Okta's setup instructions; the certificate verifies assertions came from your Okta org.
- **NameID Format** — email format `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`, matching the Okta EmailAddress setting.
- **SP Entity ID / ACS URL** — EDG's own identifiers, read-only; paste into Okta.
- **Security toggles** — enable Want Assertions Signed / Strict Mode for production.

### Shared — Identity, teams & roles

See [Team & Role Provisioning](05_Team_and_Role_Provisioning.md). Okta normally sends clean group **names** in the `groups` claim — use those names directly in the rulebook.
