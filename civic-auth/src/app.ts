
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { CookieStorage, CivicAuth } from '@civic/auth/server';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.AUTH_PORT || 3001;
const BASE_URL = process.env.BASE_URL!;              // e.g. http://localhost:3001
const BOT_CALLBACK_URL = process.env.BOT_CALLBACK_URL!;  // e.g. http://localhost:3000/auth/notify

const civicConfig = {
  clientId: process.env.CLIENT_ID!,
  oauthServer: process.env.AUTH_SERVER || 'https://auth.civic.com/oauth',
  redirectUrl: `${BASE_URL}/auth/callback`,
  postLogoutRedirectUrl: `${BASE_URL}/auth/logoutcallback`,
};

const appAuth = express();
appAuth.use(bodyParser.urlencoded({ extended: false }));
appAuth.use(bodyParser.json());
appAuth.use(cookieParser());

// Attach CivicAuth
appAuth.use((req: Request, res: Response, next) => {
  // @ts-ignore
  req.storage = new CookieStorage(req, res);
  // @ts-ignore
  req.civicAuth = new CivicAuth(req.storage, civicConfig);
  next();
});

// Return a login URL
appAuth.get('/auth/url', async (req: Request, res: Response) => {
  const state = req.query.state as string;
  // Build URL including state
  // @ts-ignore
  const loginUrl = await req.civicAuth.buildLoginUrl({ state });
  res.json({ loginUrl });
});

// OAuth callback
appAuth.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as any;
    // @ts-ignore
    await req.civicAuth.resolveOAuthAccessCode(code, state);
    // @ts-ignore
    const user = await req.civicAuth.getUser();

    // Notify Bot Server
    await axios.post(BOT_CALLBACK_URL, { state, user });

    res.send('Login successful! You can now close this window.');
  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).send('Authentication failed');
  }
});

// Optional logout
appAuth.get('/auth/logout', async (req: Request, res: Response) => {
  // @ts-ignore
  const url = await req.civicAuth.buildLogoutRedirectUrl();
  res.redirect(url);
});

appAuth.listen(PORT, () => {
  console.log(`🔐 Auth server listening on port ${PORT}`);
});
