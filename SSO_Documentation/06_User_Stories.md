# Solix EDG — SSO User Stories

An overview/foundation story plus one story per identity-provider tile, each covering authentication + identity mapping + team & role provisioning for that provider. Field-level detail lives in the matching provider document; these stories reference it rather than repeating it.

Format: single consolidated capability per provider (per PM direction), Given/When/Then acceptance criteria, no RBAC. `⚑ decision:` marks open design calls (listed once at the end — they apply to the provider stories).

Target: epic **EDG-545 (Settings - SSO)**, Sprint-5.

---

## Story 1 — SSO settings overview and provider selection

**User Story**
As an EDG administrator, I want an SSO settings area that explains the options and lets me choose an identity provider and protocol, so that I understand the model before configuring and start with the right integration.

**Problem/Context**
Before configuring any provider, an admin needs to understand EDG's SSO model — the provider × protocol matrix, how team and role provisioning works, and the one-way principle (EDG reads from the identity provider and never writes back). This story delivers the SSO landing experience and the overview documentation. Reference: `SSO_Documentation/00_Overview`.

**Acceptance Criteria**
1. Given Settings → SSO, When I open it, Then I see the available providers grouped as "Recommended" (Microsoft Entra ID, Okta) and "Other Providers" (Generic OpenID Connect, Generic SAML 2.0), each with a short description and a Configure action.
2. Given a provider that supports both protocols (Entra, Okta), When I view its card, Then it indicates OIDC and SAML are both available.
3. Given the section header, Then it explains that SSO connects an enterprise identity provider and that provider templates pre-fill endpoints and claims.
4. Given a provider has been configured, When I return to the SSO list, Then its card shows a configured/enabled status and the protocol in use.
5. Given the overview concepts (provider × protocol model, the four login steps, team & role provisioning, and the one-way principle), Then they are documented and available to admins per `SSO_Documentation/00_Overview`.

---

## Story 2 — Configure SSO with Microsoft Entra ID

**User Story**
As an EDG administrator, I want to configure Single Sign-On with Microsoft Entra ID over OIDC or SAML, including automatic team and role assignment, so that Entra users can sign in to EDG and are placed on the right team and role without manual setup.

**Problem/Context**
EDG needs enterprise SSO with Microsoft Entra ID. The Entra-side setup steps, the values to copy into EDG, and every field are specified in `SSO_Documentation/01_Microsoft_Entra_ID` and the shared `SSO_Documentation/05_Team_and_Role_Provisioning`.

**Acceptance Criteria**
1. Given Settings → SSO, When I open Microsoft Entra ID, Then I can choose the protocol (OIDC or SAML) via a toggle.
2. Given OIDC, Then I can enter Tenant ID, Client ID, Client Secret, and Discovery URI; the Callback URL is auto-generated and read-only; advanced options (scope, response type, JWS algorithm, client auth method, PKCE, nonce, clock skew, custom params) default to the recommended values in the doc.
3. Given SAML, Then I can enter IdP Entity ID, IdP SSO Login URL, and IdP X.509 Certificate; SP Entity ID and ACS URL are auto-generated and read-only; NameID defaults to `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`; security options (Strict Mode, Want Assertions Signed, Want Messages Signed, Send Signed AuthN Request) are available.
4. Given either protocol, Then I can configure identity mapping (JWT principal claims, claims mapping, initial admins, principal domain, enforce principal domain, self-signup) and team & role provisioning (group claim, placement mode, rulebook, default role, assign roles from groups, keep in sync on login) per the docs.
5. Given the Entra group claim carries group Object IDs, When rules are evaluated, Then they match on those IDs; given Entra is configured to emit names, Then they match names.
6. Given a completed config, When I click Test Connection, Then EDG validates the OIDC discovery document or the SAML IdP metadata and reports success or failure.
7. Given a saved config, When an Entra user signs in, Then they are authenticated and provisioned to teams and role per the provisioning rules (subject to self-signup).
8. Given a required field is empty, When I try to save, Then EDG blocks the save and indicates the missing field.

---

## Story 3 — Configure SSO with Okta

**User Story**
As an EDG administrator, I want to configure Single Sign-On with Okta over OIDC or SAML, including automatic team and role assignment, so that Okta users can sign in to EDG and are placed correctly without manual setup.

**Problem/Context**
EDG needs enterprise SSO with Okta Workforce Identity. The Okta-side setup steps, the values to copy into EDG, and every field are specified in `SSO_Documentation/02_Okta` and the shared `SSO_Documentation/05_Team_and_Role_Provisioning`.

**Acceptance Criteria**
1. Given Settings → SSO, When I open Okta, Then I can choose the protocol (OIDC or SAML) via a toggle.
2. Given OIDC, Then I can enter Client ID, Client Secret, and Discovery URI; the Callback URL is auto-generated and read-only; advanced options default to the recommended values in the doc.
3. Given SAML, Then I can enter IdP Entity ID, IdP SSO Login URL, and IdP X.509 Certificate; SP Entity ID and ACS URL are auto-generated and read-only; NameID defaults to `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`; security options are available.
4. Given either protocol, Then I can configure identity mapping and team & role provisioning per the docs.
5. Given Okta emits group names in the `groups` claim, When rules are evaluated, Then they match on those names.
6. Given a completed config, When I click Test Connection, Then EDG validates the OIDC discovery document or the SAML IdP metadata and reports success or failure.
7. Given a saved config, When an Okta user signs in, Then they are authenticated and provisioned to teams and role per the provisioning rules (subject to self-signup).
8. Given a required field is empty, When I try to save, Then EDG blocks the save and indicates the missing field.

---

## Story 4 — Configure SSO with a Custom OIDC provider

**User Story**
As an EDG administrator, I want to configure Single Sign-On with any OpenID Connect–compliant provider, including automatic team and role assignment, so that organisations not using Entra or Okta can still connect their identity provider to EDG.

**Problem/Context**
EDG must support generic OIDC providers (Keycloak, Ping, Auth0, Google Workspace, internal IdPs). Setup steps and every field are specified in `SSO_Documentation/03_Custom_OIDC` and the shared `SSO_Documentation/05_Team_and_Role_Provisioning`.

**Acceptance Criteria**
1. Given Settings → SSO, When I open Generic OpenID Connect, Then it is OIDC-only (no protocol toggle).
2. Given the connection fields, Then I can enter Client ID, Client Secret, and Discovery URI; the Callback URL is auto-generated and read-only; advanced options (scope, public key URLs, response type, JWS algorithm, client auth method, PKCE, nonce, clock skew, custom params) default to the recommended values in the doc.
3. Given the connection, Then I can configure identity mapping and team & role provisioning per the docs.
4. Given the provider may emit group names or IDs, When rules are evaluated, Then they match on whatever value the token carries.
5. Given a completed config, When I click Test Connection, Then EDG validates the discovery document and reports success or failure.
6. Given a saved config, When a user signs in, Then they are authenticated and provisioned to teams and role per the provisioning rules (subject to self-signup).
7. Given a required field is empty, When I try to save, Then EDG blocks the save and indicates the missing field.

---

## Story 5 — Configure SSO with a Custom SAML provider

**User Story**
As an EDG administrator, I want to configure Single Sign-On with any SAML 2.0 provider, including automatic team and role assignment, so that organisations using enterprise SAML identity providers can connect them to EDG.

**Problem/Context**
EDG must support generic SAML 2.0 providers (Ping, OneLogin, ADFS, Shibboleth). Setup steps and every field are specified in `SSO_Documentation/04_Custom_SAML` and the shared `SSO_Documentation/05_Team_and_Role_Provisioning`.

**Acceptance Criteria**
1. Given Settings → SSO, When I open Generic SAML 2.0, Then it is SAML-only (no protocol toggle).
2. Given the panel, Then EDG shows a read-only SP Entity ID and ACS URL for me to copy into the provider.
3. Given the IdP fields, Then I can enter IdP Entity ID, IdP SSO Login URL, and IdP X.509 Certificate; NameID defaults to `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`; SP certificate/private key and security options (Strict Mode, Want Assertions Signed, Want Messages Signed, Send Signed AuthN Request, token validity) are available.
4. Given the connection, Then I can configure identity mapping and team & role provisioning per the docs.
5. Given the group attribute in the assertion, When rules are evaluated, Then they match on the values the provider sends.
6. Given a completed config, When I click Test Connection, Then EDG validates the IdP metadata and reports success or failure.
7. Given a saved config, When a user signs in, Then they are authenticated and provisioned to teams and role per the provisioning rules (subject to self-signup).
8. Given a required field is empty, When I try to save, Then EDG blocks the save and indicates the missing field.

---

## Story 6 (supporting) — Align Teams & Users "Add User" roles to canonical roles

**User Story**
As an EDG administrator, I want the Add User form's role options to match EDG's canonical roles, so that users I pre-create for SSO can hold the same roles SSO assigns.

**Problem/Context**
The Add User "Default Role" dropdown offers `Admin, Data Steward, Data Analyst, Data Engineer, Viewer`, which don't match EDG's canonical roles (`Admin, Connection Admin, Steward, Viewer`) used by Access Control and SSO provisioning. Pre-created SSO users can't be given Steward or Connection Admin, causing drift.

**Acceptance Criteria**
1. Given the Add User form, When I open Default Role, Then it lists exactly Admin, Connection Admin, Steward, Viewer, with labels and colours matching Access Control.
2. Given SSO provisioning and Add User, Then both use the same role vocabulary.
3. Given members created with legacy role names, When this ships, Then they are migrated. `⚑ decision:` confirm mapping (Data Steward → Steward; Data Analyst / Data Engineer → ?).

---

## Cross-cutting decisions (apply to Stories 2–5, resolve before build)

1. **Role precedence** — when a user matches several rules with different roles, which wins? Proposed: Admin > Connection Admin > Steward > Viewer.
2. **Sync behaviour** — with "Keep in sync on every login" on, does EDG *remove* teams/roles no longer matched, or only *add* new ones? Proposed: remove as well (full sync).
3. **Self-signup off** — unknown users are blocked; pre-created users are matched by email. Confirmed behaviour.
