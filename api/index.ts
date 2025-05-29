import express from 'express';
import bodyParser from 'body-parser';
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { http } from "viem";
import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { xdcTestnet } from "viem/chains";
import twilio from "twilio";
import axios from "axios";
import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { USDC, erc20 } from "@goat-sdk/plugin-erc20";
import { coingecko } from "@goat-sdk/plugin-coingecko";
import { viem } from "@goat-sdk/wallet-viem";
import dotenv from 'dotenv';

dotenv.config();

// Wallet setup
const account = privateKeyToAccount(process.env.KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  transport: http(process.env.RPC_PROVIDER_URL!),
  chain: xdcTestnet,
});

// Twilio client & WhatsApp “from” 
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const twilioFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

// In‐memory auth store; swap for a real DB in production
const loggedIn = new Map<string, { name: string }>();

(async () => {
  // Initialize on‐chain tools
  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [
        erc20({
            tokens: [USDC],
        }),
      coingecko({ apiKey: "CG-omKTqVxpPKToZaXWYBb8bCJJ" }),
    ],
  });

  const app = express();
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // 1️⃣ Twilio webhook for incoming WhatsApp messages
  app.post("/whatsapp", async (req, res) => {
    const from = req.body.From as string;        // e.g. "whatsapp:+15551234567"
    const body = (req.body.Body as string)?.trim();
    const phone = from.replace("whatsapp:", "");

    // If not logged in, send the Auth Service URL so the browser
    // can set the PKCE cookie and redirect to Civic
    if (!loggedIn.has(phone)) {
      const link = `${process.env.AUTH_BASE_URL}/auth/url?state=${encodeURIComponent(phone)}`;
      await twilioClient.messages.create({
        to: from,
        from: twilioFrom,
        body: `👋 To get started, please log in: ${link}`
      });
      return res.sendStatus(200);
    }

    // Already logged in → AI flow
    try {
      const aiResult = await generateText({
        model: openai("gpt-4o-mini"),
        tools,
        maxSteps: 10,
        prompt: body!,
      });
      await twilioClient.messages.create({
        to: from,
        from: twilioFrom,
        body: aiResult.text
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("AI error:", err);
      await twilioClient.messages.create({
        to: from,
        from: twilioFrom,
        body: "Sorry, I'm unable to process your request right now. Please try again later."
      });
      return res.status(500).json({ success: false });
    }
  });

  // 2️⃣ Receive Civic‐Auth callbacks to mark users as logged in
  app.post("/api/notify-login", async (req, res) => {
    const { phone, user } = req.body as { phone: string; user: any };
    const name = user.name || "User";
    loggedIn.set(phone, { name });

    try {
      await twilioClient.messages.create({
        to: `whatsapp:${phone}`,
        from: twilioFrom,
        body: `✅ You’ve successfully signed in as *${name}*! You can now chat with your AI assistant.`
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error("Notify‐login error:", err);
      return res.status(500).json({ ok: false });
    }
  });

  // Start server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Agent service running on port ${PORT}`);
  });
})();
