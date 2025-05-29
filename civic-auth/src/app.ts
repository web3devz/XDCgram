import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { CookieStorage, CivicAuth } from '@civic/auth/server';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.AUTH_PORT || 3001;
const BASE_URL = process.env.BASE_URL!;               // e.g. http://localhost:3001
const BOT_CALLBACK_URL = process.env.BOT_CALLBACK_URL!; // e.g. http://localhost:3000/api/notify-login

const civicConfig = {
  clientId: process.env.CLIENT_ID!,
  oauthServer: process.env.AUTH_SERVER || 'https://auth.civic.com/oauth',
  redirectUrl: `${BASE_URL}/auth/callback`,
  postLogoutRedirectUrl: `${BASE_URL}/auth/logoutcallback`,
};

const appAuth = express();
appAuth.use(bodyParser.json());
appAuth.use(cookieParser());

// 👇 Subclass CookieStorage so we can call its protected ctor
class ExpressCookieStorage extends CookieStorage {
  async delete(key: string): Promise<void> {
    this.res.clearCookie(key, this.settings);
  }
  private req: Request;
  private res: Response;
  constructor(req: Request, res: Response) {
    // pass secure flag based on your BASE_URL
    super({ secure: BASE_URL.startsWith('https') });
    this.req = req;
    this.res = res;
  }
  async get(key: string): Promise<string | null> {
    return Promise.resolve(this.req.cookies[key] ?? null);
  }
  async set(key: string, value: string): Promise<void> {
    this.res.cookie(key, value, this.settings);
  }
}

// 🔧 Attach storage + auth per request
appAuth.use((req, res, next) => {
  const storage = new ExpressCookieStorage(req, res);
  // 2 args now: storage + config
  const civicAuth = new CivicAuth(storage, civicConfig);
  (req as any).storage = storage;
  (req as any).civicAuth = civicAuth;
  next();
});

// 1️⃣ Build PKCE verifier, set cookie, and redirect to Civic
appAuth.get('/auth/url', async (req: Request, res: Response) => {
  const state = req.query.state as string;
  if (!state) return res.status(400).send('Missing state (phone)');
  try {
    // buildLoginUrl() will call storage.set(...) internally
    const loginUrl = await (req as any).civicAuth.buildLoginUrl({ state });
    return res.redirect(loginUrl.toString());
  } catch (err) {
    console.error('Error building login URL:', err);
    return res.status(500).send('Could not build login URL');
  }
});

// 2️⃣ Civic redirect callback
appAuth.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    // This will read the code_verifier cookie you set, exchange code for tokens
    await (req as any).civicAuth.resolveOAuthAccessCode(
      req.query.code as string,
      req.query.state as string
    );
    const user = await (req as any).civicAuth.getUser();
    // Persist full user info in another cookie if you like
    await (req as any).storage.set('user', JSON.stringify(user));

    // Notify your Bot/Agent server
    await axios.post(BOT_CALLBACK_URL, {
      phone: req.query.state,
      user,
    });

    return res.send('✅ Login successful! You can now close this window.');
  } catch (err) {
    console.error('Auth callback error:', err);
    return res.status(500).send('Authentication failed');
  }
});

// 3️⃣ Optional logout redirect
appAuth.get('/auth/logout', async (req: Request, res: Response) => {
  try {
    const url = await (req as any).civicAuth.buildLogoutRedirectUrl();
    return res.redirect(url.toString());
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).send('Could not log out');
  }
});

appAuth.listen(PORT, () => {
  console.log(`🔐 Auth server listening on port ${PORT}`);
});
