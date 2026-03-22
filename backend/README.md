# Ledger API

A Node.js + Express + MongoDB backend for a simple ledger-based money transfer system.

This project implements:

- User authentication with JWT (cookie or bearer token)
- Multi-account support per user
- Double-entry style ledger entries (credit/debit)
- Transaction idempotency key handling
- System-user-only endpoint for initial funding
- Email notifications via Gmail OAuth2

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Data Model](#data-model)
6. [API Reference](#api-reference)
7. [Authentication Model](#authentication-model)
8. [Environment Variables](#environment-variables)
9. [Local Setup](#local-setup)
10. [Run Commands](#run-commands)
11. [Sample End-to-End Flow](#sample-end-to-end-flow)
12. [Operational Notes](#operational-notes)
13. [Known Gaps and Improvement Areas](#known-gaps-and-improvement-areas)
14. [License](#license)

## Overview

Ledger API is designed around an append-only ledger concept:

- Account balances are derived from ledger entries, not stored as mutable balance fields.
- A transfer writes both a `DEBIT` entry for sender and a `CREDIT` entry for receiver.
- Authentication is JWT based, with logout implemented by token blacklisting.

The service currently listens on port `3000` and mounts routes under:

- `/api/auth`
- `/api/accounts`
- `/api/transactions`

## Architecture

High-level request flow:

1. Request hits Express app (`src/app.js`).
2. Auth middleware validates JWT and blacklist status where required.
3. Controller validates business input and orchestrates model operations.
4. Mongoose models persist users, accounts, transactions, ledger entries, and token blacklist records.
5. Email service sends registration or transaction notifications (where enabled).

Core design points:

- Ledger entries are intended to be immutable.
- Transactions use idempotency keys to avoid duplicate processing.
- Protected endpoints depend on `req.user` from auth middleware.

## Tech Stack

- Runtime: Node.js (CommonJS)
- Web framework: Express 5
- Database: MongoDB with Mongoose
- Auth: JWT (`jsonwebtoken`) + cookie parser
- Password hashing: `bcryptjs`
- Email: `nodemailer` + Google OAuth2 (`googleapis`)
- Env config: `dotenv`
- Dev runner: `nodemon`

## Project Structure

```text
.
|-- server.js
|-- src/
|   |-- app.js
|   |-- config/
|   |   `-- db.js
|   |-- controllers/
|   |   |-- account.controller.js
|   |   |-- auth.controller.js
|   |   `-- transaction.controller.js
|   |-- middleware/
|   |   `-- auth.middleware.js
|   |-- models/
|   |   |-- account.model.js
|   |   |-- blacklist.model.js
|   |   |-- ledger.model.js
|   |   |-- transaction.model.js
|   |   `-- user.model.js
|   |-- routes/
|   |   |-- account.routes.js
|   |   |-- auth.routes.js
|   |   `-- transaction.routes.js
|   `-- services/
|       `-- email.service.js
`-- package.json
```

## Data Model

### User (`user`)

- `email` (unique, required, regex validated)
- `name` (required)
- `password` (required, min length 6, excluded by default)
- `systemUser` (boolean, default `false`, immutable, excluded by default)
- `createdAt`, `updatedAt`

Behavior:

- Password is hashed in a pre-save hook.
- Instance method `comparePassword()` checks hash.

### Account (`account`)

- `userId` (ref `user`, indexed, required)
- `status` (`ACTIVE | FROZEN | CLOSED`, default `ACTIVE`)
- `currency` (default `INR`)
- `systemUser` (boolean, immutable, excluded by default)
- `createdAt`, `updatedAt`

Behavior:

- `getBalance()` aggregates ledger entries:
  - Balance = sum(`CREDIT`) - sum(`DEBIT`)

### Transaction (`transaction`)

- `fromAccount` (ref `account`, indexed)
- `toAccount` (ref `account`, indexed)
- `status` (`PENDING | COMPLETED | FAILED | REVERSED`, default `PENDING`)
- `amount` (number, min 0)
- `idempotencyKey` (unique, indexed, required)
- `createdAt`, `updatedAt`

### Ledger (`ledger`)

- `account` (ref `account`, indexed, immutable)
- `amount` (number, immutable)
- `transaction` (ref `transaction`, indexed, immutable)
- `type` (`CREDIT | DEBIT`, immutable)
- `createdAt`, `updatedAt`

Behavior:

- Multiple update/delete hooks throw errors to enforce immutability intent.

### Token Blacklist (`TokenBlacklist`)

- `token` (unique, required)
- `blacklistedAt` (default now, immutable)
- `createdAt`, `updatedAt`

Behavior:

- TTL index removes records after ~3 days.

## API Reference

Base URL: `http://localhost:3000`

### Auth Routes

#### POST `/api/auth/register`

Registers a new user.

Request body:

```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "secret123"
}
```

Success response (`201`):

```json
{
  "user": {
    "_id": "...",
    "email": "alice@example.com",
    "name": "Alice"
  },
  "token": "jwt-token"
}
```

#### POST `/api/auth/login`

Logs in an existing user.

Request body:

```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

Success response (`201`) returns user info + token and sets `token` cookie.

#### POST `/api/auth/logout` (Protected)

Blacklists current token and clears cookie.

Header example:

```http
Authorization: Bearer <jwt>
```

### Account Routes

All account routes are protected.

#### POST `/api/accounts/`

Creates an account for authenticated user.

Response (`201`):

```json
{
  "account": {
    "_id": "...",
    "userId": "...",
    "status": "ACTIVE",
    "currency": "INR"
  }
}
```

#### GET `/api/accounts/`

Returns all accounts owned by authenticated user.

#### GET `/api/accounts/balance/:accountId`

Returns derived balance for the account if owned by current user.

Response (`200`):

```json
{
  "accountId": "...",
  "balance": 1500
}
```

### Transaction Routes

#### POST `/api/transactions/` (Protected)

Creates a transfer between two accounts.

Request body:

```json
{
  "fromAccount": "<ObjectId>",
  "toAccount": "<ObjectId>",
  "amount": 250,
  "idempotencyKey": "txn-unique-001"
}
```

Behavior:

- Validates account existence and account status.
- Checks idempotency key against previous transactions.
- Writes debit and credit ledger entries.

#### POST `/api/transactions/system/initial-funds` (Protected: System User)

Transfers funds from the system account to a target account.

Request body:

```json
{
  "toAccount": "<ObjectId>",
  "amount": 1000,
  "idempotencyKey": "initial-fund-001"
}
```

Authorization requirement:

- JWT must belong to a user with `systemUser = true`.

## Authentication Model

Token extraction order:

1. `req.cookies.token`
2. `Authorization: Bearer <token>`

Validation performed by middleware:

- Token existence check
- Token blacklist check
- JWT verification using `JWT_SECRET_KEY`
- User lookup by decoded `userId`

System-user middleware additionally ensures user has `systemUser` enabled.

## Environment Variables

Create a `.env` file in the project root.

Required variables:

| Variable         | Description                               |
| ---------------- | ----------------------------------------- |
| `MONGO_URI`      | MongoDB connection string                 |
| `JWT_SECRET_KEY` | Secret used to sign and verify JWT tokens |
| `EMAIL_USER`     | Gmail address used for outgoing email     |
| `CLIENT_ID`      | Google OAuth2 client ID                   |
| `CLIENT_SECRET`  | Google OAuth2 client secret               |
| `REFRESH_TOKEN`  | Google OAuth2 refresh token               |

Example:

```env
MONGO_URI=mongodb://127.0.0.1:27017/ledger
JWT_SECRET_KEY=replace_with_strong_secret
EMAIL_USER=your-email@gmail.com
CLIENT_ID=your-google-client-id
CLIENT_SECRET=your-google-client-secret
REFRESH_TOKEN=your-google-refresh-token
```

## Local Setup

### Prerequisites

- Node.js (LTS recommended)
- npm
- MongoDB instance

### Install

```bash
npm install
```

## Run Commands

Start in development mode:

```bash
npm run dev
```

Start in production mode:

```bash
npm start
```

Service URL: `http://localhost:3000`

## Sample End-to-End Flow

1. Register two users via `POST /api/auth/register`.
2. Login and capture bearer token.
3. Create accounts via `POST /api/accounts/`.
4. If needed, fund source account through system-user initial-funds endpoint.
5. Transfer funds with `POST /api/transactions/` and unique `idempotencyKey`.
6. Verify balances via `GET /api/accounts/balance/:accountId`.

## Operational Notes

- Tokens are blacklisted on logout and automatically expire from blacklist after 3 days.
- Account balances are derived at query time from ledger entries.
- Registration email is sent after user creation.
- Transaction success email is active for system initial funding; regular transfer email code is present but currently commented out.

## Known Gaps and Improvement Areas

Based on current implementation, consider addressing these before production:

1. Add centralized error handling middleware and async error wrappers.
2. Add request validation middleware (for body, params, and ObjectId format checks).
3. Enforce account ownership/authorization in `POST /api/transactions/` (currently account existence is checked, ownership is not).
4. In `createTransaction`, return immediately after insufficient balance response.
5. Ensure transaction documents are always persisted and status transitions are fully consistent within DB transactions.
6. Abort/rollback sessions in all failure paths and handle session cleanup robustly.
7. Set secure cookie options (`httpOnly`, `secure`, `sameSite`) for JWT cookie.
8. Add rate limiting and security headers (helmet, CORS policy).
9. Add test coverage (unit + integration); current `npm test` is placeholder.
10. Add health/readiness endpoints for deployment monitoring.

## License

ISC
