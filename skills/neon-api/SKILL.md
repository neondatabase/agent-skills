---
name: neon-api
description: Use this skill when managing Neon projects, branches, compute endpoints, databases, roles, API keys, organizations, or operations programmatically via the Neon REST API.
---

# Neon API

The Neon API is a REST API that allows you to manage your Neon projects programmatically. It provides resource-oriented URLs, accepts form-encoded request bodies, returns JSON-encoded responses, and supports standard HTTP response codes, authentication, and verbs.

## Documentation

Refer to the [Neon API documentation](https://neon.com/docs/reference/api-reference):

```bash
curl -H "Accept: text/markdown" https://neon.com/docs/reference/api-reference
```

For the API reference, see the [Neon API Reference](https://api-docs.neon.tech/reference/getting-started-with-neon-api). Note that the Neon API reference (api-docs.neon.tech) currently doesn't support fetching the documentation as markdown.

## Base URL

All Neon API requests must be made to the following base URL:

```
https://console.neon.tech/api/v2/
```

## Supporting Documents

- About API guidelines, authentication, rate limiting, and core concepts, review `resources/guidelines.md`
- About managing projects (create, list, update, delete, connection URI), review `resources/projects.md`
- About managing branches, databases, and roles, review `resources/branches.md`
- About managing compute endpoints (create, list, update, delete, start, suspend, restart), review `resources/endpoints.md`
- About managing API keys (list, create, revoke), review `resources/keys.md`
- About managing operations (list, retrieve details), review `resources/operations.md`
- About managing organizations, members, invitations, and organization API keys, review `resources/organizations.md`
