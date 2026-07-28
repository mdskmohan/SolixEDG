# Solix EDG — Microsoft Entra ID SSO

Microsoft Entra ID (formerly Azure Active Directory) lets people sign in to Solix EDG with their Microsoft 365 / Entra accounts. Entra supports **both OIDC and SAML 2.0** — pick one. OIDC is recommended for new setups.

> Read [Overview](00_Overview.md) and [Team & Role Provisioning](05_Team_and_Role_Provisioning.md) first. Provisioning (teams, roles, self-signup) is the same for both protocols and is documented separately.

---

## Part A — Entra ID with OIDC

### What to do in Entra (before EDG)

1. **Azure Portal → Microsoft Entra ID → App registrations → New registration.** Name it, e.g. `Solix EDG`.
2. **Redirect URI:** choose **Web** and paste EDG's **Callback URL** (Settings → SSO → Microsoft Entra ID → OIDC; it is read-only, format `https://<your-edg>/callback`). Register.
3. **Overview:** copy the **Application (client) ID** and the **Directory (tenant) ID**.
4. **Certificates & secrets → Client secrets → New client secret.** Copy the secret **Value** immediately (it is shown only once).
5. **Token configuration → Add groups claim →** select **Security groups** (or the groups you use for access). This lets EDG place users on teams.
   - ⚠️ By default Entra emits group **Object IDs** (GUIDs like `a1b2c3d4-…`), not names. Use those IDs in the EDG rulebook, or set the groups claim to emit names instead — **Cloud-only group display names**, or **sAMAccountName** for on-premises-synced groups.
   - *Note:* the `groups` claim is **not** included in OIDC tokens by default — this step is what adds it. If a user belongs to more than ~200 groups, Entra omits the claim (overage) and falls back to a Graph lookup.
6. **(Optional) API permissions:** the delegated Microsoft Graph permissions `openid`, `email`, `profile` are usually present by default; keep them.

### Values to copy into EDG

| Entra value | EDG field (OIDC) |
|---|---|
| Directory (tenant) ID | **Tenant ID** |
| Application (client) ID | **Client ID** |
| Client secret **Value** | **Client Secret** |
| `https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration` | **Discovery URI** |
| EDG's own read-only value | **Callback URL** (auto — paste it into Entra step 2, above) |

---

## Part B — Entra ID with SAML

### What to do in Entra (before EDG)

1. **Microsoft Entra ID → Enterprise applications → New application → Create your own application →** *"Integrate any other application you don't find in the gallery (Non-gallery)."* Name it `Solix EDG`.
2. Open the app → **Single sign-on → SAML**.
3. **Basic SAML Configuration:**
   - **Identifier (Entity ID)** = EDG's **SP Entity ID** (Settings → SSO → Microsoft Entra ID → SAML; read-only).
   - **Reply URL (Assertion Consumer Service URL)** = EDG's **ACS URL** (read-only).
4. **Attributes & Claims:**
   - Set the **Unique User Identifier (Name ID)** to the user's email (`user.mail` / `user.userprincipalname`), NameID format **emailAddress**.
   - Add a **group claim** (Groups → emit Object IDs or names) so EDG can assign teams.
5. **SAML Certificates → Certificate (Base64) → Download.** This is the **IdP X.509 Certificate**.
6. **Set up (section 4 on the page):** copy the **Login URL** and the **Microsoft Entra Identifier**.

### Values to copy into EDG

| Entra value | EDG field (SAML) |
|---|---|
| Microsoft Entra Identifier (`https://sts.windows.net/<tenant-id>/`) | **IdP Entity ID** |
| Login URL | **IdP SSO Login URL** |
| Certificate (Base64) | **IdP X.509 Certificate** |
| EDG's own read-only values | **SP Entity ID**, **ACS URL** (auto — paste into Entra step 3) |

---

## EDG field reference (Entra)

### OIDC — Connection

- **Tenant ID** — *Definition:* your Entra tenant (directory) ID. *Example:* `12345678-1234-1234-1234-123456789012`. *Why it matters:* tells EDG which Entra tenant to trust.
- **Client ID** — *Definition:* the Application (client) ID of the EDG app registration. *Why it matters:* identifies EDG to Entra.
- **Client Secret** — *Definition:* the secret generated in Certificates & secrets. *Note:* store securely; rotate on Entra's expiry schedule.
- **Discovery URI** — *Definition:* Entra's OpenID metadata endpoint. *Why it matters:* EDG auto-discovers all other endpoints and signing keys from it.
- **Callback URL** — *Definition:* where Entra returns the user after login. *Note:* read-only, auto-generated; must be registered as a Redirect URI in Entra.

### OIDC — Advanced (recommended defaults)

- **Scope** — default `openid email profile`; add `groups` if you assign teams by group.
- **Response Type / Preferred JWS Algorithm / Client Auth Method** — protocol defaults (`code`, `RS256`, `client_secret_post`); change only to match a non-standard Entra config.
- **Disable PKCE / Use Nonce** — security options. *Note:* PKCE adds security to the code flow and is recommended **on** (leave "Disable PKCE" off) unless engineering confirms otherwise.

### SAML

- **IdP Entity ID / IdP SSO Login URL / IdP X.509 Certificate** — the three values from Entra above; the certificate verifies that assertions genuinely came from your tenant.
- **NameID Format** — how users are identified in the assertion; email format `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` (the correct identifier even for SAML 2.0).
- **SP Entity ID / ACS URL** — EDG's own identifiers, read-only; paste them into Entra.
- **Security toggles** (Strict Mode, Want Assertions Signed, Want Messages Signed, Send Signed AuthN Request) — enable for production to enforce signature validation.

### Shared — Identity, teams & roles

See [Team & Role Provisioning](05_Team_and_Role_Provisioning.md) for JWT/principal claims, admins, the group→team→role rulebook, and self-signup behaviour. For Entra, the group claim usually carries **Object IDs** — use those in the rulebook.
