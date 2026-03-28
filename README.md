# ToDo

A small full-stack to-do app: **Express** API with **MySQL**, JWT auth, and a static **HTML/CSS/JS** frontend. Each user has their own tasks stored in the database.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MySQL](https://www.mysql.com/) running locally (or reachable from your machine)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create the database and tables**

   Import `database.sql` (creates `auth_demo`, `users`, and `todos` if missing):

   ```bash
   mysql -u root -p < database.sql
   ```

   Adjust user/password if your MySQL account is not `root` with no password.

3. **Configure the server (optional)**

   By default the app connects to `localhost`, user `root`, empty password, database `auth_demo`. Override with environment variables if needed:

   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET` (use a long random string in production)

## Run

```bash
npm start
```

Open **http://localhost:3000** — register, sign in, then add and manage your tasks.
