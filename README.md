# Atomic x402 on Sui - Payment Required Protocol

> Demonstrating atomic payment + access grant using Sui's Programmable Transaction Blocks (PTBs)

## 🎯 What is x402 on Sui?

This project showcases how the HTTP 402 "Payment Required" protocol can be revolutionized on Sui blockchain using Programmable Transaction Blocks. Unlike traditional implementations that require payment verification delays, Sui's architecture enables **atomic payment + access grant** in a single, indivisible transaction.

## 🌟 Key Innovation

### Traditional x402 Flow (Other Blockchains)

```
1. Client pays → 2. Submit TxID → 3. Server polls blockchain → 4. Wait for confirmation → 5. Verify payment → 6. Grant access
```

**Problems**: Polling delay, verification complexity, potential re-org issues, trust gap

### x402 on Sui Flow

```
1. Server builds PTB (payment + access) → 2. Client signs → 3. Atomic execution → 4. Instant access
```

**Benefits**: No polling, no verification delay, zero trust issues, atomic execution

## 📦 Published SDK

The x402 SDK is now published on npm and available for anyone to use:

```bash
npm install @atomic402/sui-sdk
```

**Package:** [@atomic402/sui-sdk](https://www.npmjs.com/package/@atomic402/sui-sdk)

### Quick SDK Usage

```typescript
// Server-side
import { createX402Server } from "@atomic402/sui-sdk";

const server = createX402Server({
  suiClient,
  serverKeypair,
  packageId: "YOUR_PACKAGE_ID",
  registryId: "YOUR_REGISTRY_ID",
});

// Client-side
import { createX402Client } from "@atomic402/sui-sdk";

const client = createX402Client({
  suiClient,
  network: "testnet",
});
```

See the [SDK Documentation](./packages/sdk/README.md) for full details.

## 📦 Project Structure

```
atomic402/
├── move/                    # Sui Move smart contracts
│   ├── sources/
│   │   └── content_access.move  # Content + AccessReceipt NFT
│   └── Move.toml
├── packages/
│   ├── sdk/                 # x402 SDK (client + server)
│   │   ├── src/
│   │   │   ├── server.ts    # PTB construction, x402 responses
│   │   │   └── client.ts    # Transaction signing, access verification
│   └── shared/              # Shared types
│       └── src/types.ts
├── apps/
│   ├── server/              # Hono API server
│   │   └── src/index.ts     # x402 endpoints, transaction sponsorship
│   └── web/                 # Next.js frontend
│       └── app/             # Demo UI with wallet integration
└── deployed-contracts.json  # Deployed package IDs
```

## 🚀 Quick Start

### Prerequisites

- [Sui CLI](https://docs.sui.io/build/install)
- [Bun](https://bun.sh/) or Node.js 18+
- Sui wallet (Sui/Slush Wallet browser extension)

### 1. Install Dependencies

```bash
bun install
```

### 2. Deploy Move Contract

```bash
cd move
sui client publish --gas-budget 100000000
```

After deployment, update `deployed-contracts.json` with the Package ID.

### 3. Configure Server

Create `apps/server/.env`:

```env
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
PACKAGE_ID=<your_deployed_package_id>
PORT=3001

# Optional: Enable gasless transactions
# SPONSOR_PRIVATE_KEY=<hex_private_key>
```

### 4. Start Development Servers

```bash
# Terminal 1: Start backend API
cd apps/server
bun dev

# Terminal 2: Start frontend
cd apps/web
bun dev
```

Visit `http://localhost:3000`

## 🎮 How to Use the Demo

1. **Connect Wallet**: Click "Connect Wallet" in the header
2. **Browse Content**: View available premium content with prices
3. **Purchase Access**: Click "Purchase Access" on any content
4. **Sign Transaction**: Your wallet will prompt you to sign a PTB
5. **Instant Access**: Content is unlocked immediately after transaction confirms
6. **View Content**: Click "View Content" to read your purchased content

## 🔬 Technical Deep Dive

### The Core Innovation: Atomic Execution

The Move contract's `purchase_and_grant_access` function demonstrates atomic execution:

```move
public entry fun purchase_and_grant_access(
    content: &ContentItem,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    // 1. Verify payment
    assert!(coin::value(&payment) >= content.price, EInsufficientPayment);

    // 2. Transfer payment to creator (ATOMIC)
    transfer::public_transfer(payment, content.creator);

    // 3. Mint access receipt NFT (ATOMIC)
    let receipt = AccessReceipt { /* ... */ };
    transfer::public_transfer(receipt, ctx.sender());
}
```

Both operations happen in ONE transaction - they either both succeed or both fail.

### Server SDK: PTB Construction

```typescript
const tx = new Transaction();

// Split coin for payment
const [coin] = tx.splitCoins(tx.gas, [price]);

// Call purchase function atomically
tx.moveCall({
  target: `${packageId}::content_access::purchase_and_grant_access`,
  arguments: [contentObject, coin, clockObject],
});

// Serialize and return as x402 response
const transactionBytes = await tx.build({ client });
```

### Client SDK: Simple Signing

```typescript
// Parse x402 response
const { transactionBytes } = x402Response.paymentRequired;

// Sign (no construction needed!)
const { signature } = await wallet.signTransaction(txBytes);

// Submit to server for sponsorship
await fetch("/execute", {
  method: "POST",
  body: JSON.stringify({ transactionBytes, signature }),
});
```

## 📊 API Reference

### Server Endpoints

#### `GET /content`

List all available content

#### `GET /content/:id?address=<wallet_address>`

Request specific content

- Returns 402 with PTB if no access
- Returns content if access granted

#### `POST /content/:id/execute`

Execute signed transaction

```json
{
  "transactionBytes": "base64_encoded_tx",
  "signature": "signature_string",
  "publicKey": "public_key_string"
}
```

#### `GET /receipts/:address`

Get all access receipts for an address

## 🧪 Testing

### Manual Testing

1. Deploy contract to testnet
2. Get testnet SUI from [faucet](https://faucet.sui.io/)
3. Run the demo and purchase content
4. Verify on [SuiScan](https://suiscan.xyz/testnet)

### Automated Testing (Coming Soon)

```bash
bun test
```

## 🎨 Use Cases

### 1. AI API Billing

AI agents can autonomously pay for API calls with on-chain metering

### 2. Premium Content

Publishers can monetize content with instant, trustless access

### 3. GameFi Items

Atomic payment + item upgrade/transfer in games

### 4. DeFi Strategies

One-click paid strategy execution with complex PTBs
