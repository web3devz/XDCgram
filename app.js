const express = require('express');
const { ethers } = require('ethers');
const dotenv = require('dotenv');
const lockerAbi = require('./abi/bridgeLocker.json');
const minterAbi = require('./abi/bridgeMinter.json');
const managerAbi = require('./abi/MinterManager.json');
const usdcAbi = require('./abi/usdc.json');

dotenv.config();

const app = express();
app.use(express.json());

const LOCKER_ETH = '0xA3272527814B500F5233c97C1571baCAC244a7a3';
const LOCKER_ARB = '0xB08A3886210de9462391D3001DC6AF58b49C8f13';
const MINTER_XDC = process.env.MINTER_CONTRACT;
const MANAGER_XDC = process.env.MINTER_MANAGER;
const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const USDC_ARB = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';
const DEST_CHAIN_ID_XDC = 51;
const CHAIN_ID_ETH = 11155111;
const CHAIN_ID_ARB = 421614;

const ETH_RPC = process.env.ETH_RPC;
const ARB_RPC = process.env.ARB_RPC;
const XDC_RPC = process.env.XDC_RPC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ethProvider = new ethers.providers.JsonRpcProvider(ETH_RPC);
const arbProvider = new ethers.providers.JsonRpcProvider(ARB_RPC);
const xdcProvider = new ethers.providers.JsonRpcProvider(XDC_RPC);

const ethWallet = new ethers.Wallet(PRIVATE_KEY, ethProvider);
const arbWallet = new ethers.Wallet(PRIVATE_KEY, arbProvider);
const xdcWallet = new ethers.Wallet(PRIVATE_KEY, xdcProvider);

const lockerEth = new ethers.Contract(LOCKER_ETH, lockerAbi, ethWallet);
const lockerArb = new ethers.Contract(LOCKER_ARB, lockerAbi, arbWallet);
const minterXdc = new ethers.Contract(MINTER_XDC, minterAbi, xdcWallet);
const managerXdc = new ethers.Contract(MANAGER_XDC, managerAbi, xdcWallet);
const usdcEth = new ethers.Contract(USDC_SEPOLIA, usdcAbi, ethWallet);
const usdcArb = new ethers.Contract(USDC_ARB, usdcAbi, arbWallet);

app.post('/bridge/eth-to-xdc', async (req, res) => {
  const { to, amount } = req.body;
  try {
    const amt = ethers.utils.parseUnits(amount.toString(), 6);
    const fee = await lockerEth.fees(DEST_CHAIN_ID_XDC);
    if (await lockerEth.globalPaused()) return res.status(400).json({ error: 'Bridge paused' });

    const available = await managerXdc.minterAllowance(MINTER_XDC);
    if (amt.gt(available)) return res.status(400).json({ error: 'Amount exceeds available' });

    if ((await usdcEth.allowance(ethWallet.address, LOCKER_ETH)).lt(amt)) {
      await (await usdcEth.approve(LOCKER_ETH, amt)).wait();
    }

    const tx = await lockerEth.userLock(DEST_CHAIN_ID_XDC, to, amt, { value: fee });
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/bridge/arb-to-xdc', async (req, res) => {
  const { to, amount } = req.body;
  try {
    const amt = ethers.utils.parseUnits(amount.toString(), 6);
    const fee = await lockerArb.fees(DEST_CHAIN_ID_XDC);
    if (await lockerArb.globalPaused()) return res.status(400).json({ error: 'Bridge paused' });

    const available = await managerXdc.minterAllowance(MINTER_XDC);
    if (amt.gt(available)) return res.status(400).json({ error: 'Amount exceeds available' });

    if ((await usdcArb.allowance(arbWallet.address, LOCKER_ARB)).lt(amt)) {
      await (await usdcArb.approve(LOCKER_ARB, amt)).wait();
    }

    const tx = await lockerArb.userLock(DEST_CHAIN_ID_XDC, to, amt, { value: fee });
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/bridge/xdc-to-eth', async (req, res) => {
  const { to, amount } = req.body;
  try {
    const amt = ethers.utils.parseUnits(amount.toString(), 6);
    const fee = await minterXdc.fees(CHAIN_ID_ETH);
    if (await minterXdc.globalPaused()) return res.status(400).json({ error: 'Bridge paused' });

    const available = await minterXdc.lockedOn(CHAIN_ID_ETH);
    if (amt.gt(available)) return res.status(400).json({ error: 'Amount exceeds available' });

    const tx = await minterXdc.userBurn(CHAIN_ID_ETH, to, amt, { value: fee });
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/bridge/xdc-to-arb', async (req, res) => {
  const { to, amount } = req.body;
  try {
    const amt = ethers.utils.parseUnits(amount.toString(), 6);
    const fee = await minterXdc.fees(CHAIN_ID_ARB);
    if (await minterXdc.globalPaused()) return res.status(400).json({ error: 'Bridge paused' });

    const available = await minterXdc.lockedOn(CHAIN_ID_ARB);
    if (amt.gt(available)) return res.status(400).json({ error: 'Amount exceeds available' });

    const tx = await minterXdc.userBurn(CHAIN_ID_ARB, to, amt, { value: fee });
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Bridge server running on http://localhost:3000'));
