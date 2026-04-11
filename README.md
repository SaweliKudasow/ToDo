# ToDo

A small full-stack to-do app: **Express** API with **MySQL**, JWT auth, and a static **HTML/CSS/JS** frontend. Each user has their own tasks stored in the database.

## Project layout

| Path | Role |
|------|------|
| `index.js` | App entry: loads `.env`, mounts routes, static files |
| `server/config.js` | MySQL pool, `JWT_SECRET`, `PORT` |
| `server/middleware/auth.js` | JWT `Bearer` middleware |
| `server/routes/auth.js` | `POST /register`, `POST /login`, `GET /me` |
| `server/routes/todos.js` | `GET/POST/PATCH/DELETE` under `/todos` |
| `public/js/*.js` | Frontend ES modules (`main.js` wires UI) |

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

3. **Environment**

   Copy `.env.example` to `.env` and set `DB_HOST`, `DB_USER`, `DB_NAME` (and optional `DB_PASSWORD`, `JWT_SECRET`, `PORT`). See `.env.example` for variable names.

## Run

```bash
npm start
```

Open **http://localhost:3000** — register, sign in, then add and manage your tasks.
