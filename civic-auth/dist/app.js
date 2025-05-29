var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
import cookieParser from "cookie-parser";
import { CookieStorage, CivicAuth } from "@civic/auth/server";
import dotenv from "dotenv";
dotenv.config();
import "dotenv/config";
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.use(cookieParser());
const config = {
    clientId: process.env.CLIENT_ID,
    // oauthServer is not necessary for production.
    oauthServer: process.env.AUTH_SERVER || 'https://auth.civic.com/oauth',
    redirectUrl: `http://localhost:${PORT}/auth/callback`,
    postLogoutRedirectUrl: `http://localhost:${PORT}/`,
};
class ExpressCookieStorage extends CookieStorage {
    constructor(req, res) {
        super({
            secure: process.env.NODE_ENV === "production",
        });
        this.req = req;
        this.res = res;
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.req.cookies[key];
        });
    }
    set(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            this.res.cookie(key, value, this.settings);
        });
    }
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const key in this.req.cookies) {
                this.res.clearCookie(key);
            }
        });
    }
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.res.clearCookie(key);
        });
    }
}
app.use((req, res, next) => {
    req.storage = new ExpressCookieStorage(req, res);
    // Create and attach the civicAuth instance
    req.civicAuth = new CivicAuth(req.storage, config);
    next();
});
app.get("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const url = yield req.civicAuth.buildLoginUrl();
    res.redirect(url.toString());
}));
app.get("/auth/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code, state } = req.query;
    yield req.civicAuth.resolveOAuthAccessCode(code, state);
    res.redirect("/admin/hello");
}));
const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.civicAuth.isLoggedIn())
        return res.status(401).send("Unauthorized");
    next();
});
app.use("/admin", authMiddleware);
app.get("/admin/hello", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield req.civicAuth.getUser();
    res.setHeader("Content-Type", "text/html");
    res.send(`
    <html>
      <body>
        <h1>Hello, ${user === null || user === void 0 ? void 0 : user.name}!</h1>
        <button onclick="window.location.href='/auth/logout'">Logout</button>
      </body>
    </html>
  `);
}));
app.get("/auth/logout", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const url = yield req.civicAuth.buildLogoutRedirectUrl();
    res.redirect(url.toString());
}));
app.get("/auth/logoutcallback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { state } = req.query;
    console.log(`Logout-callback: state=${state}`);
    yield req.storage.clear();
    res.redirect("/");
}));
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
