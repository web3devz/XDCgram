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

const account = privateKeyToAccount(process.env.KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  transport: http(process.env.RPC_PROVIDER_URL!),
  chain: xdcTestnet,
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);
const twilioFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

const loggedIn = new Map<string, { name: string }>();

(async () => {
  const tools = await getOnChainTools({
    wallet: viem(walletClient),
    plugins: [
      erc20({ tokens: [USDC] }),
      coingecko({ apiKey: "CG-omKTqVxpPKToZaXWYBb8bCJJ" })
    ],
  });

  const app = express();
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  app.post("/whatsapp", async (req, res) => {
    const from = req.body.From as string;
    const body = (req.body.Body as string)?.trim();
    const phone = from.replace("whatsapp:", "");

    if (!loggedIn.has(phone)) {
      const link = `${process.env.AUTH_BASE_URL}/auth/url?state=${encodeURIComponent(phone)}`;
      await twilioClient.messages.create({
        to: from,
        from: twilioFrom,
        body: `👋 To get started, please log in: ${link}`
      });
      return res.sendStatus(200);
    }

    const swapMatch = body?.match(/swap\s+(\d+(\.\d+)?)\s+usdc\s+from\s+(eth|arb|xdc)\s+to\s+(eth|arb|xdc)/i);
    if (swapMatch) {
      const amount = swapMatch[1];
      const fromChain = swapMatch[3].toLowerCase();
      const toChain = swapMatch[4].toLowerCase();
      const routeKey = `${fromChain}->${toChain}`;
      const validRoutes: Record<string, string> = {
        "eth->xdc": "eth-to-xdc",
        "arb->xdc": "arb-to-xdc",
        "xdc->eth": "xdc-to-eth",
        "xdc->arb": "xdc-to-arb"
      };

      const apiPath = validRoutes[routeKey];
      if (!apiPath) {
        await twilioClient.messages.create({
          to: from,
          from: twilioFrom,
          body: `❌ Unsupported swap direction: ${fromChain.toUpperCase()} to ${toChain.toUpperCase()}`
        });
        return res.sendStatus(200);
      }

      try {
        const response = await axios.post(`https://xdcgram-production.up.railway.app/bridge/${apiPath}`, {
          to: process.env.WALLET_ADDRESS,
          amount
        });
        await twilioClient.messages.create({
          to: from,
          from: twilioFrom,
          body: `✅ Swap successful!\n\n🔁 ${amount} USDC from ${fromChain.toUpperCase()} to ${toChain.toUpperCase()}\n🔗 TxHash: ${response.data.txHash}`
        });
      } catch (e: any) {
        const errMsg = e?.response?.data?.error || e.message;
        await twilioClient.messages.create({
          to: from,
          from: twilioFrom,
          body: `❌ Swap failed: ${errMsg}`
        });
      }
      return res.sendStatus(200);
    }

    try {
      const aiResult = await generateText({
        model: openai("gpt-4o"),
        tools,
        maxSteps: 10,
        prompt: body!
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

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Agent service running on port ${PORT}`);
  });
})();
