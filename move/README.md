# x402 Content Access Move Contract

## Overview

This Move contract implements the core x402 functionality on Sui, demonstrating atomic payment + access grant in a single transaction.

## Key Features

- **ContentItem**: Shared objects representing premium content with pricing
- **AccessReceipt**: NFT minted atomically with payment as proof of purchase
- **Atomic Execution**: Payment and access grant happen in one indivisible transaction

## Deployment

### Build

```bash
cd move
sui move build
```

### Publish to Testnet

```bash
sui client publish --gas-budget 100000000
```

After publishing, save the Package ID and update `deployed-contracts.json` in the root.

### Create Sample Content

```bash
sui client call \
  --package <PACKAGE_ID> \
  --module content_access \
  --function create_content \
  --args "Premium Article" "An exclusive article about x402" 1000000000 "https://content.example.com/article-1" \
  --gas-budget 10000000
```

## Contract Functions

### `create_content`

Creates a new premium content item (shared object).

### `purchase_and_grant_access`

**THE KEY FUNCTION**: Atomically transfers payment and mints access receipt NFT.
This is what makes x402 on Sui special - no verification delay!

## Architecture Highlight

Traditional x402 flow:

1. Pay → 2. Submit TxID → 3. Server verifies → 4. Grant access

Sui x402 flow:

1. Sign PTB (payment + access) → 2. Server sponsors → 3. Execute (atomic)

The server never needs to verify payment because Sui's consensus guarantees atomicity!
