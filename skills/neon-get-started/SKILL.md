---
name: neon-get-started
description: Use this skill when users ask to 'Get started with Neon' to connect their project to a Neon database. Interactive guide for project setup, connection strings, dependencies, schema, and authentication.
---

# Get Started with Neon

Interactive guide to help users get started with Neon in their project. Sets up their Neon project (with a connection string) and connects their database to their code.

## Trigger Phrases

- "Get started with Neon"
- "Connect my app to Neon"
- "Set up Neon database"

## Communication Style

**Keep all responses succinct:**

- Tell the user what you did: "Created users table with 3 columns"
- Ask direct questions when needed: "Which database should I use?"
- Avoid verbose explanations of what you're about to do

**Examples:**

- Good: "Added DATABASE_URL to .env. Ready to connect?"
- Bad: "I'm going to add the DATABASE_URL environment variable to your .env file so that your application can connect to the database..."

---

## Interactive Setup Flow

### Step 1: Check Organizations and Projects

**First, check for organizations:**

- If they have 1 organization: Default to that organization
- If they have multiple organizations: List all and ask which one to use

**Then, check for projects within the selected organization:**

- **No projects**: Ask if they want to create a new project
- **1 project**: Ask "Would you like to use '{project_name}' or create a new one?"
- **Multiple projects (<6)**: List all and let them choose
- **Many projects (6+)**: List recent projects, offer to create new or specify by name/ID

### Step 2: Database Setup

**Get the connection string:**

- Use the MCP server to get the connection string for the selected project

**Configure it for their environment:**

- Most projects use a `.env` file with `DATABASE_URL`
- For other setups, check project structure and ask

**Before modifying .env:**

1. Try to read the .env file first
2. If readable: Use search_replace to update or append
3. If unreadable: Use append command or show the line to add manually:

```
DATABASE_URL=postgresql://user:password@host/database
```

### Step 3: Install Dependencies

Check if they have a common driver installed. If not, recommend based on their deployment platform and runtime:

**Quick Recommendations:**

| Environment              | Driver                     | Install                                |
| ------------------------ | -------------------------- | -------------------------------------- |
| Vercel (Edge/Serverless) | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| Cloudflare Workers       | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| AWS Lambda               | `@neondatabase/serverless` | `npm install @neondatabase/serverless` |
| Traditional Node.js      | `pg`                       | `npm install pg`                       |
| Long-running servers     | `pg` with pooling          | `npm install pg`                       |

**For complex scenarios** (multiple runtimes, hybrid architectures, or unsure which to use):

Reference the **choose-connection-method** skill for detailed guidance:

```bash
npx skill add neondatabase/agent-skills -s choose-connection-method
```

This skill provides a decision tree based on deployment platform (Vercel, Cloudflare, Netlify, Railway, etc.) and runtime environment (serverless, edge, long-running).

### Step 4: Understand the Project

**If it's an empty/new project:**
Ask briefly (1-2 questions):

- What are they building?
- Any specific technologies?

**If it's an established project:**
Skip questions - infer from codebase. Update relevant code to use the driver.

### Step 5: Authentication (Optional)

**Skip if project doesn't need auth** (CLI tools, scripts, static sites).

**If project could benefit from auth:**
Ask: "Does your app need user authentication? Neon Auth can handle sign-in/sign-up, social login, and session management."

**If they want auth:**

- Use MCP server `provision_neon_auth` tool
- Guide through framework-specific setup
- Configure environment variables
- Set up basic auth code

### Step 6: ORM Setup

**Check for existing ORM** (Prisma, Drizzle, TypeORM).

**If no ORM found:**
Ask: "Want to set up an ORM for type-safe database queries?"

If yes, suggest based on project. If no, proceed with raw SQL.

### Step 7: Schema Setup

**Check for existing schema:**

- SQL migration files
- ORM schemas (Prisma, Drizzle)
- Database initialization scripts

**If existing schema found:**
Ask: "Found existing schema definitions. Want to migrate these to your Neon database?"

**If no schema:**
Ask if they want to:

1. Create a simple example schema (users table)
2. Design a custom schema together
3. Skip schema setup for now

**Example schema:**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Step 8: What's Next

"You're all set! Here are some things I can help with:

- Neon-specific features (branching, autoscaling, scale-to-zero)
- Connection pooling for production
- Writing queries or building API endpoints
- Database migrations and schema changes
- Performance optimization"

---

## Best Practices

### Security

1. Never commit connection strings to version control
2. Use environment variables for all credentials
3. Prefer SSL connections (default in Neon)
4. Use least-privilege database roles
5. Rotate API keys and passwords regularly

### Neon-Specific Features

1. **Branching**: Create database branches for development/staging
2. **Autoscaling**: Neon automatically scales compute based on load
3. **Scale to Zero**: Databases automatically suspend after inactivity
4. **Point-in-Time Recovery**: Restore databases to any point in time

---

## Resume Support

If user says "Continue with Neon setup", check what's already configured:

- MCP server connection
- .env file with DATABASE_URL
- Dependencies installed
- Schema created

Then resume from where they left off.

## Related Skills

- **choose-connection-method** - Deep dive into connection options by platform/runtime
- **neon-serverless** - Serverless driver for database queries
- **neon-drizzle** - Drizzle ORM integration
- **neon-auth** - Authentication setup
- **neon-api** - Managing projects programmatically
