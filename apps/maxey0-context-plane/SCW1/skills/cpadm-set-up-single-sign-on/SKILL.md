---
name: cpadm-set-up-single-sign-on
description: Sets up single sign-on (SSO) for a company's Claude organization, on a Team or Enterprise plan or in Claude Console. It confirms the admin role and parent organization, verifies the company email domain with a DNS TXT record, connects the company identity provider (Okta, Microsoft Entra ID, Google Workspace, OneLogin, JumpCloud or Duo) through the WorkOS setup flow, tests sign-in, then decides whether to require SSO and how to provision users with invite only, JIT or SCIM. Use when asked to set up, enable or configure single sign-on, SSO, SAML or OpenID Connect sign-in for a company or organization.
metadata:
  context-plane-concept: cpadm-identity-and-access
  context-plane-label: Set up single sign-on for a Claude organization
  context-plane-type: procedural
  context-plane-agents: Maxey1797:primary Maxey1798:checker Maxey1766:support
---

# Set up single sign-on for a Claude organization

Single sign-on is available for Team plans, Enterprise plans and Claude Console organizations. The DNS change, the identity provider (IdP) configuration and every toggle below belong to the organization's admin: prepare each step and its exact values, and let the admin make the change.

## Inputs

- **Organization type:** Team plan, Enterprise plan or Claude Console.
- **Email domain(s)** to verify, such as the company's main email domain.
- **Identity provider:** Okta, Microsoft Entra ID, Google Workspace, OneLogin, JumpCloud or Duo.
- **Provisioning choice:** invite only, Just-in-Time (JIT) or SCIM.

## Steps

1. **Confirm the role and access.**
   - Team or Enterprise plan: the admin must be an Owner or Primary Owner. Claude Console: an Admin.
   - The admin needs access to the DNS settings of the company's email domain and to the company's IdP.
2. **Find the setup path.** SSO settings live on a parent organization, which can be linked to only one IdP.
   - Enterprise plan: created automatically.
   - Team plan: created when SSO is enabled for the first time.
   - Claude Console with an existing Team or Enterprise plan: if `platform.claude.com/settings/identity` opens, the Console organization is already linked and SSO is already configured. If not, it joins the Team or Enterprise plan's parent organization by a merge in step 4, after the domains are verified.
   - Claude Console without a Team or Enterprise plan: the company contacts Anthropic's Sales team to request a parent organization. Once it exists, the Identity settings page appears in Console and setup continues from step 3.
3. **Verify the domain.** Verifying a domain doesn't change anyone's access; access changes only once SSO is required.
   1. Open **Organization and access** in Claude (`claude.ai/admin-settings/organization`) or **Identity and access** in Console (`platform.claude.com/settings/identity`).
   2. In **Domains**, click **Add or edit domains**, enter each domain, click **+**, then **Save**. All domains of one organization must be managed through a single IdP.
   3. Click **Verify** next to the domain, enter the domain and click **Continue**.
   4. Copy the full TXT value with the copy button. It begins with `anthropic-domain-verification-` and is longer than the box shows. Save it before leaving the screen, because once the domain shows **Pending** the value isn't shown again.
   5. In the DNS provider, add a TXT record on the domain exactly as entered (root, not `www`), alongside any existing TXT records, with that value.
   6. Wait 10 minutes, then click **Refresh** until the green **Verified** badge shows. DNS changes can take 24 to 48 hours to propagate globally.
   7. If it stays **Pending**: confirm the record appears at the root of the domain, that the value matches character for character (the check is case-sensitive), and that the domain wasn't removed and re-added (each re-add generates a new value).
   8. Once verified, **Domain memberships** in the **Domains** section lists the existing Claude and Console accounts on the domain, with a CSV or JSON download. Use it to find who will be affected in step 6.
   9. Optional, with the admin's yes: **Restrict organization creation** under **Security** stops anyone from creating new Claude or Console organizations with the verified domains, personal accounts included.
4. **Merge a Console organization, when step 2 called for it.** The merge needs the domains verified first, and every member of the invited organization needs an email address on them.
   1. An Owner of the Team or Enterprise organization opens **Organization and access** on claude.ai (Console can't start a merge), clicks **Invite** under **Merge Organizations**, searches for the Console organization by name, clicks **Next**, checks the member count and clicks **Invite**.
   2. The invited organization's admins get an email titled "Parent Organization Update: New Member Organization Proposed". An Admin of the Console organization (an Owner, for a Claude organization) accepts at `claude.ai/settings/join-proposal` within 14 days.
   3. An Owner or Admin of an organization already under the parent approves under **Organization and access** > **Pending Organizations**, or from the link in that email. The merge completes only after both approvals; when one person is admin on both sides, one approval is enough.
5. **Connect the IdP.** In the **Authentication** section, click **Setup SSO** (or **Manage SSO**) and follow the WorkOS setup guide for the IdP. At the end, run **Test Single Sign-on** and fix any error it reports. Assign everyone who needs access to the Anthropic app in the IdP. If several Claude or Console organizations share the parent organization, consider a separate IdP group for each.
6. **Decide whether to require SSO.** In **Authentication**, turn on **Require SSO for Claude** and/or **Require SSO for Console** only after the test passes and the right people are assigned in the IdP. When SSO isn't required, people can choose **Continue with SSO** or **Continue with email**. Once **Require SSO for Claude** is on, anyone on the domain who isn't assigned to the Anthropic app can't sign in, which also locks them out of their existing Free, Pro, Team, Max or Ultra accounts. Those accounts aren't deleted, only unreachable. Before turning it on, the admin tells employees when it happens and advises anyone who won't be assigned to export their conversation history first.
7. **Choose provisioning** under **User provisioning**.
   - **Invite only** (default): members are added and removed in Claude or Console settings.
   - **JIT:** users assigned to the Anthropic IdP app are created at their first sign-in, with the User role.
   - **SCIM:** directory sync for provisioning and deprovisioning, with roles or seat tiers from IdP groups. Available on Enterprise plans and Console organizations, but not on Team plans or on a Console organization merged under a Team plan's parent organization.
8. **Record the credential expiry.** Note when the IdP's SAML signing certificate or OpenID Connect client secret expires. To rotate it, open **Manage SSO**, update the certificate under **Metadata configuration** (SAML) or replace the client secret (OpenID Connect), save, then click **Test sign-in**.

## Check (checker role)

- Each domain shows **Verified**.
- **Test Single Sign-on** passed, and a test user in the IdP group can sign in with **Continue with SSO**.
- Before **Require SSO** is turned on, at least one Owner can sign in through SSO, and employees have been told.
- The chosen provisioning method is available on the plan.
- Console users who start from the IdP's app list land on claude.ai, because IdP-initiated sign-in isn't supported for Console organizations that share SSO with a Team or Enterprise plan. If the IdP allows it, add a bookmark named "Claude Console" pointing to `platform.claude.com/login?sso=true`.

## Boundaries

- If **Require SSO** is on and the certificate or client secret has expired, nobody can sign in to fix it. The admin then contacts Support from an Owner's or Primary Owner's email address.
- **Delete connection** under **Danger zone** can't be undone and signs out everyone with an email address on the verified domains. Turn off **Require SSO** first. Never take this step without the admin's explicit yes.
- Domain verification runs through WorkOS, Anthropic's provider for domain verification and SSO setup.

## Sources

Read on November 27, 2026:

- https://support.claude.com/en/articles/13132885-set-up-single-sign-on-sso
- https://support.claude.com/en/articles/10276682-important-considerations-before-enabling-single-sign-on-sso-and-jit-scim-provisioning
