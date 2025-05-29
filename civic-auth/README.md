Auth Service for XDCgram

This repository hosts the Civic Auth Service, a standalone microservice that handles user authentication using Civic's OAuth2 PKCE flow. It provides an easy way to generate login URLs, manage secure PKCE code verifiers via HTTP-only cookies, process callback exchanges, and notify downstream services (e.g., an AI bot) upon successful user login.

Features

PKCE Flow: Implements OAuth2 PKCE with Civic Auth.

Cookie-Based Storage: Securely stores the PKCE code verifier in HTTP-only cookies.

Callback Notification: Posts user authentication events to a configured bot server.

Express Framework: Built on Express with TypeScript for strong typing.

API Endpoints

1. Generate Login URL

Endpoint: GET /auth/url

Query Params:

state (string): A unique identifier (e.g., the user’s phone number)

Behavior: Sets a cookie containing the PKCE code_verifier and redirects the client to Civic’s authorization endpoint.

Response: HTTP 302 redirect to Civic Auth.

2. OAuth Callback

Endpoint: GET /auth/callback

Query Params:

code (string): Authorization code returned by Civic.

state (string): The state parameter from the initial request.

Behavior:

Reads the code_verifier from the cookie.

Exchanges the code for tokens.

Retrieves user info and stores it in a cookie.

Notifies the bot server via BOT_CALLBACK_URL with a POST JSON payload:

{ "phone": "<state>", "user": { /* user info */ } }

Response: Plain text confirmation: ✅ Login successful! You can now close this window.

3. Logout Redirect (Optional)

Endpoint: GET /auth/logout

Behavior: Redirects the user to Civic’s logout endpoint.

Cookie Storage

ExpressCookieStorage subclasses Civic’s CookieStorage to implement two methods:

get(key: string): Promise<string | null> — Reads from req.cookies[key].

set(key: string, value: string): Promise<void> — Writes via res.cookie(key, value, settings).

Settings such as secure (HTTPS only) are automatically applied based on BASE_URL.

Error Handling

**Missing **state in /auth/url: Returns 400 Bad Request.

Build URL Error: Returns 500 Internal Server Error.

PKCE or Token Exchange Error: Returns 500 Internal Server Error with a log entry.

Logout Error: Returns 500 Internal Server Error.

License

MIT © Sambit Sargam Ekalabya

