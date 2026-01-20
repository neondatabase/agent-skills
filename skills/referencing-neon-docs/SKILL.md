---
name: referencing-neon-docs
description: Use this skill when you need to look up Neon documentation, verify Neon-related information, or find accurate details about Neon features, APIs, or configurations.
---

# Referencing Neon Docs

The Neon documentation is the source of truth for all Neon-related information. Always verify Neon-related claims, configurations, and best practices against the official documentation.

## Getting the Documentation Index

To get a list of all available Neon documentation pages:

```bash
curl https://neon.com/llms.txt
```

This returns an index of all documentation pages with their URLs.

## Fetching Individual Documentation Pages

To fetch any documentation page as markdown for review:

```bash
curl -H "Accept: text/markdown" https://neon.com/docs/<path>
```

**Examples:**

```bash
# Fetch the API reference
curl -H "Accept: text/markdown" https://neon.com/docs/reference/api-reference

# Fetch connection pooling docs
curl -H "Accept: text/markdown" https://neon.com/docs/connect/connection-pooling

# Fetch branching documentation
curl -H "Accept: text/markdown" https://neon.com/docs/introduction/branching
```

## Best Practices

1. **Always verify** - When answering questions about Neon features, APIs, or configurations, fetch the relevant documentation to verify your response is accurate.

2. **Check llms.txt first** - If you're unsure which documentation page covers a topic, fetch the llms.txt index to find the relevant URL. Don't make up URLs.

3. **Docs are the source of truth** - If there's any conflict between your training data and the documentation, the documentation is correct. Neon features and APIs evolve, so always defer to the current docs.

4. **Cite your sources** - When providing information from the docs, reference the documentation URL so users can read more if needed.
