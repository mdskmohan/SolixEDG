# Solix EDG — Custom SAML SSO

Use **Custom SAML** to connect any SAML 2.0 identity provider that isn't Entra or Okta — for example Ping Identity, OneLogin, ADFS, or Shibboleth.

> Read [Overview](00_Overview.md) and [Team & Role Provisioning](05_Team_and_Role_Provisioning.md) first. It is the same SAML engine used by the Entra and Okta presets — nothing is pre-filled for you.

---

## Setup workflow

SAML is a two-way exchange. You give the provider EDG's details, and the provider gives you its details.

1. **Get EDG's Service Provider details** (Settings → SSO → Generic SAML 2.0 — both read-only):
   - **SP Entity ID**
   - **ACS URL** (Assertion Consumer Service URL)
2. **Create a SAML application** in your provider and paste those two values in:
   - **Entity ID / Audience** = EDG's **SP Entity ID**
   - **ACS URL / Reply URL / Recipient** = EDG's **ACS URL**
3. **Configure user identification and groups** in the provider:
   - **Name ID** = the user's email, format **emailAddress**.
   - Add a **group attribute** in the assertion so EDG can assign teams.
4. **Get your provider's Identity Provider details:**
   - **IdP Entity ID**
   - **SSO Login URL**
   - **IdP X.509 Certificate** (the full Base64 certificate, including the `BEGIN/END` lines)
5. **Enter those in EDG** and configure the security options.

---

## Values to copy into EDG

| Provider value | EDG field |
|---|---|
| IdP Entity ID | **IdP Entity ID** |
| SSO Login URL | **IdP SSO Login URL** |
| IdP signing certificate (Base64) | **IdP X.509 Certificate** |
| EDG's own read-only values | **SP Entity ID**, **ACS URL** (auto — paste into your provider, step 2) |

---

## EDG field reference

### Identity Provider (from your provider)

- **IdP Entity ID** — *Definition:* the unique identifier of your identity provider. *Note:* must match exactly what the provider is configured with.
- **IdP SSO Login URL** — *Definition:* the URL users are redirected to in order to authenticate.
- **IdP X.509 Certificate** — *Definition:* the provider's public certificate. *Why it matters:* EDG uses it to verify that assertions are genuine. *Note:* paste the full certificate including the `BEGIN CERTIFICATE` / `END CERTIFICATE` lines.
- **NameID Format** — *Definition:* how users are identified in the assertion. *Value:* email format — `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` (this is the correct identifier even for SAML 2.0). *Why it matters:* it must match the Name ID your provider sends, or user matching fails.

### Service Provider (EDG's own, read-only)

- **SP Entity ID / ACS URL** — auto-generated; copy them into your provider. Cannot be edited.
- **SP X.509 Certificate / SP Private Key** — required only if you sign requests or encrypt assertions.

### Security

- **Strict Mode** — only accept valid signed/encrypted assertions; enable for production.
- **Want Assertions Signed / Want Messages Signed** — require the provider to sign; recommended for security.
- **Send Signed AuthN Request / Send Encrypted NameID** — additional hardening; require SP key material.
- **Token Validity** — how long the EDG session token stays valid after login.

### Shared — Identity, teams & roles

See [Team & Role Provisioning](05_Team_and_Role_Provisioning.md). For SAML, the group values come from the **group attribute** you added to the assertion — use those values in the rulebook.
