# Solix EDG — Team & Role Provisioning (shared)

This applies to **every** provider and protocol — Entra ID, Okta, Custom OIDC, and Custom SAML. It controls what happens *after* a person is authenticated: whether they get an EDG account, who they are, which team(s) they join, and what role they get.

It corresponds to the **Identity & Sign-in** and **Team & Role Provisioning** sections of the EDG SSO panel.

---

## 1. Identity & Sign-in

- **JWT Principal Claims** — *Definition:* the claims EDG checks, in order, to identify the user. *Default:* `email, preferred_username, sub`. *Why it matters:* the first matching claim becomes the user's identity. ⚠️ *Note:* incorrect claims can lock out all users, including admins — change only with reason.
- **JWT Claims Mapping** — *Definition:* optional override that maps provider claims to EDG's `username` and `email`. *Example:* `username:preferred_username;email:email`. *Note:* rarely needed; the defaults work for standard Entra/Okta setups.
- **Initial Admins** — *Definition:* usernames that receive the EDG Admin role regardless of group. *Note:* use usernames (the part before `@`), not full email addresses. Set at least one so you are never locked out.
- **Principal Domain** — *Definition:* the default domain appended to usernames when needed. *Example:* `jnj.com`.
- **Enforce Principal Domain** — *Definition:* only allow users whose email is in the principal domain. *Default:* off.
- **Enable Self Signup** — *Definition:* automatically create an EDG account on a user's first successful login. *See section 3.*

---

## 2. Team & Role Provisioning (the rulebook)

- **Group / team claim** — *Definition:* the claim or attribute that carries the user's group memberships. *Example:* `groups`. *Why it matters:* EDG reads it to decide team and role. *Note:* OIDC must request the `groups` scope; SAML must include a group attribute in the assertion. Entra typically sends group **Object IDs**; Okta typically sends group **names**.

- **How to place people** — *Definition:* the placement mode.
  - **Map selected groups** *(recommended)* — only the groups listed in the rulebook become teams; everything else falls through to the default.
  - **Sync all groups as teams** — every group in the login becomes an EDG team, matched by name, created on demand.

- **Mapping rulebook** — *Definition:* an ordered list of rules, each *IdP group → EDG team → EDG role*.
  - **EDG teams:** Data Engineering · Analytics · Finance · Governance · Platform.
  - **EDG roles:** Viewer · Steward · Connection Admin · Admin.
  - *Example:* `Finance-Team → Finance → Viewer` · `Data-Stewards → Governance → Steward` · `IT-Admins → Platform → Admin`.
  - A user in several matching groups is placed on **all** matching teams.

- **Fallback (locked row)** — *Definition:* what happens when a user's groups match no rule. *Value:* **no team**, plus the **default role** (Viewer). *Why it matters:* safe by default — nobody is ever auto-granted Admin by accident. This row cannot be deleted.

- **Assign roles from groups** — *Definition:* also derive the EDG role from the matched group (rulebook shows the "with role" column). If off, EDG assigns teams only and roles are set manually.

- **Keep in sync on every login** — *Definition:* re-apply team and role on each sign-in, so the identity provider stays the source of truth. If a user changes departments in Entra/Okta, EDG updates them at their next login. Turn off to let admins manage team and role manually inside EDG.

---

## 3. Self-signup: on vs off

**Enable Self Signup** decides how new people become EDG users.

| | Self-signup **ON** (open door) | Self-signup **OFF** (guest list) |
|---|---|---|
| A new person's first login | EDG creates the account, then the rulebook assigns team + role | EDG blocks them until an admin has pre-created them |
| Who can sign in | Anyone with a valid company login in the provider | Only people already added under **Settings → Teams & Users** |
| Who does the work | Nobody — fully automatic | An admin adds people ahead of time |

### When self-signup is OFF — how users are added

An admin pre-creates the user in **Settings → Teams & Users → Add User** — entering the user's **Work Email**, a **Default Role**, and an optional **Team**. At login, EDG matches the person to that pre-created record **by email**.

Key rules:

- The email entered in EDG **must match** the user's email in the provider, or EDG won't recognise them.
- The person must **already exist in the provider** — EDG cannot create a company login. (See the one-way principle in [Overview](00_Overview.md).)
- If **Keep in sync on every login** is on, the rulebook still refreshes the pre-created user's team and role at each sign-in. Turn it off to keep whatever the admin set manually.

---

## 4. Test & go live

1. **Test Connection** in the EDG panel — EDG resolves the discovery document (OIDC) or validates the IdP metadata (SAML).
2. **Save.**
3. Sign in as a test user from the provider and confirm: the account is created (or matched), the right team(s) are assigned, and the role is correct.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Login fails immediately | Callback / ACS URL not registered in the provider, or wrong client credentials. |
| User signs in but has no team | Group claim missing (request the `groups` scope / add the SAML group attribute), or no matching rulebook rule. |
| User blocked with "account not set up" | Self-signup is off and the user isn't pre-created, or their email doesn't match. |
| Everyone locked out | JWT Principal Claims misconfigured — revert to `email, preferred_username, sub`. |
| Wrong role | Group not matched, or a higher-priority rule matched first — check rule order. |
