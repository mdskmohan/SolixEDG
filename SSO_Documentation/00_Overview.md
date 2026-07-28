# Solix EDG — Single Sign-On (SSO) Overview

Single Sign-On lets people sign in to Solix EDG with the company login they already have — through Microsoft Entra ID, Okta, or any standards-compliant identity provider — instead of a separate EDG username and password.

This document explains the model. Each identity provider then has its own setup guide:

- [Microsoft Entra ID](01_Microsoft_Entra_ID.md)
- [Okta](02_Okta.md)
- [Custom OIDC](03_Custom_OIDC.md)
- [Custom SAML](04_Custom_SAML.md)
- [Team & Role Provisioning](05_Team_and_Role_Provisioning.md) (shared across all providers)

---

## Two independent choices, not six integrations

Every SSO setup is defined by two separate axes:

| Axis | What it decides | Options |
|---|---|---|
| **Identity provider** | Who runs your directory and checks the login | Microsoft Entra ID · Okta · Custom |
| **Protocol** | The technical language EDG and the provider use to exchange the login | OIDC · SAML 2.0 |

- **The protocol decides the field set.** OIDC uses a Client ID, Client Secret, and a discovery URL. SAML uses an IdP Entity ID, an SSO URL, and an X.509 certificate. They are different forms.
- **The provider decides the defaults.** "Okta OIDC" and "Custom OIDC" run through the **same OIDC engine** — Okta simply pre-fills its endpoint format. The same is true for SAML.

Entra ID and Okta each support **both** protocols, so EDG offers:

| Provider | OIDC | SAML |
|---|---|---|
| Microsoft Entra ID | ✅ | ✅ |
| Okta | ✅ | ✅ |
| Custom (generic) | ✅ (Custom OIDC) | ✅ (Custom SAML) |

Under the hood there is one OIDC engine and one SAML engine; the provider cards are presets on top.

---

## What happens at login — the four steps

1. **Authentication** — the provider proves who the user is and returns their identity (an OIDC token, or a SAML assertion).
2. **Provisioning** — EDG decides whether this person gets an account (see *Enable Self Signup* in [Team & Role Provisioning](05_Team_and_Role_Provisioning.md)).
3. **Identity mapping** — EDG works out *which* EDG user this is, from the principal claim (usually email).
4. **Team & role placement** — EDG reads the user's groups and places them on the right EDG team(s) with the right role, using the rulebook.

Steps 2–4 are identical for every provider and protocol, and are documented once in [Team & Role Provisioning](05_Team_and_Role_Provisioning.md).

---

## The one-way principle (important)

**EDG reads from the identity provider. It never writes back to it.**

- EDG never creates, edits, or deletes users in Entra or Okta.
- A person must already exist in the identity provider (that is their company login) before they can sign in to EDG.
- When *Enable Self Signup* is off and an admin pre-creates a user in **Settings → Teams & Users**, that record stays in EDG and is matched to the provider by **email** at sign-in. Nothing is pushed back to Entra or Okta.

---

## Before you begin (all providers)

You will need:

1. **Admin access to Solix EDG** (Settings → SSO).
2. **Admin access to your identity provider** (Entra, Okta, or your custom IdP).
3. **EDG's deployment URL over HTTPS.** EDG generates the values the provider needs from this:
   - **OIDC:** a **Callback URL** (`https://<your-edg>/callback`) — read-only, copy it into the provider.
   - **SAML:** an **SP Entity ID** and an **ACS URL** — read-only, copy both into the provider.

Each provider guide tells you exactly which values to copy in each direction.

---

## Glossary

| Term | Plain meaning |
|---|---|
| **IdP (Identity Provider)** | The system that holds your employees and their passwords (Entra, Okta). |
| **SP (Service Provider)** | The application receiving the login — here, Solix EDG. |
| **OIDC** | OpenID Connect — the modern login protocol, built on OAuth 2.0. |
| **SAML 2.0** | The long-established enterprise login protocol, based on signed XML assertions. |
| **Claim / attribute** | A piece of information about the user carried in the login (email, name, groups). |
| **Group claim** | The list of directory groups the user belongs to — EDG uses this to assign teams and roles. |
| **JIT / self-signup** | "Just in time" — creating the EDG account automatically on first login. |
