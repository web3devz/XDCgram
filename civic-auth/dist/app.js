var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { CookieStorage, CivicAuth } from '@civic/auth/server';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
const PORT = process.env.AUTH_PORT || 3001;
const BASE_URL = process.env.BASE_URL; // e.g. http://localhost:3001
const BOT_CALLBACK_URL = process.env.BOT_CALLBACK_URL; // e.g. http://localhost:3000/api/notify-login
const civicConfig = {
    clientId: process.env.CLIENT_ID,
    oauthServer: process.env.AUTH_SERVER || 'https://auth.civic.com/oauth',
    redirectUrl: `${BASE_URL}/auth/callback`,
    postLogoutRedirectUrl: `${BASE_URL}/auth/logoutcallback`,
};
const appAuth = express();
appAuth.use(bodyParser.json());
appAuth.use(cookieParser());
// 👇 Subclass CookieStorage so we can call its protected ctor
class ExpressCookieStorage extends CookieStorage {
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.res.clearCookie(key, this.settings);
        });
    }
    constructor(req, res) {
        // pass secure flag based on your BASE_URL
        super({ secure: BASE_URL.startsWith('https') });
        this.req = req;
        this.res = res;
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            return Promise.resolve((_a = this.req.cookies[key]) !== null && _a !== void 0 ? _a : null);
        });
    }
    set(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            this.res.cookie(key, value, this.settings);
        });
    }
}
// 🔧 Attach storage + auth per request
appAuth.use((req, res, next) => {
    const storage = new ExpressCookieStorage(req, res);
    // 2 args now: storage + config
    const civicAuth = new CivicAuth(storage, civicConfig);
    req.storage = storage;
    req.civicAuth = civicAuth;
    next();
});
// 1️⃣ Build PKCE verifier, set cookie, and redirect to Civic
appAuth.get('/auth/url', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const state = req.query.state;
    if (!state)
        return res.status(400).send('Missing state (phone)');
    try {
        // buildLoginUrl() will call storage.set(...) internally
        const loginUrl = yield req.civicAuth.buildLoginUrl({ state });
        return res.redirect(loginUrl.toString());
    }
    catch (err) {
        console.error('Error building login URL:', err);
        return res.status(500).send('Could not build login URL');
    }
}));
// 2️⃣ Civic redirect callback
appAuth.get('/auth/callback', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // This will read the code_verifier cookie you set, exchange code for tokens
        yield req.civicAuth.resolveOAuthAccessCode(req.query.code, req.query.state);
        const user = yield req.civicAuth.getUser();
        // Persist full user info in another cookie if you like
        yield req.storage.set('user', JSON.stringify(user));
        // Notify your Bot/Agent server
        yield axios.post(BOT_CALLBACK_URL, {
            phone: req.query.state,
            user,
        });
        return res.send('✅ Login successful! You can now close this window.');
    }
    catch (err) {
        console.error('Auth callback error:', err);
        return res.status(500).send('Authentication failed');
    }
}));
// 3️⃣ Optional logout redirect
appAuth.get('/auth/logout', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const url = yield req.civicAuth.buildLogoutRedirectUrl();
        return res.redirect(url.toString());
    }
    catch (err) {
        console.error('Logout error:', err);
        return res.status(500).send('Could not log out');
    }
}));
appAuth.listen(PORT, () => {
    console.log(`🔐 Auth server listening on port ${PORT}`);
});
