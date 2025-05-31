# 🚀 Civic Auth Service for **XDCgram**

> A standalone OAuth2 PKCE microservice for Civic Auth — built with Express, TypeScript, and designed to talk to your bot server.

---

## 🔐 What It Does

This service handles user login flows using **Civic’s PKCE-based OAuth2**, storing secure data via **HTTP-only cookies** and notifying a **downstream service (like an AI bot)** on successful login.

---

## ⚙️ Key Features

- 🔁 **PKCE Flow:** Full OAuth2 with [Civic](https://www.civic.com/) using PKCE.
- 🍪 **Secure Cookies:** Stores `code_verifier` in HTTP-only cookies.
- 🤖 **Bot-Ready:** POSTs auth events to your bot server on login.
- ⚡ **Built with Express + TypeScript:** Strongly typed, fast, and lightweight.

---

## 📡 API Endpoints

### 1. `GET /auth/url` — Generate Login URL

**Query Params:**
- `state` _(string)_: Unique identifier, e.g., phone number.

**Behavior:**
- Sets a secure, HTTP-only cookie with the `code_verifier`.
- Redirects to Civic’s authorization page.

**Response:**
- `302 Redirect` to Civic Auth endpoint.

---

### 2. `GET /auth/callback` — Handle OAuth Callback

**Query Params:**
- `code` _(string)_: The auth code from Civic.
- `state` _(string)_: Passed from the initial `/auth/url` call.

**Behavior:**
- Reads the `code_verifier` from cookies.
- Exchanges code for tokens.
- Retrieves and stores user info in a cookie.
- Sends POST to your bot at `BOT_CALLBACK_URL`:

```json
{
  "phone": "<state>",
  "user": {
    /* user info */
  }
}
