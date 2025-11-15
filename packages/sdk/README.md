# @repo/x402-sui-sdk

TypeScript SDK for implementing x402 (Payment Required) protocol on Sui blockchain.

## Features

- 🏗️ **Server SDK**: Build PTBs and generate x402 responses
- 💳 **Client SDK**: Sign transactions and verify access
- ⚡ **Atomic Execution**: Payment and action in one transaction
- 🎯 **Type-Safe**: Full TypeScript support
- 🤖 **AI-Ready**: Perfect for autonomous agents

## Installation

```bash
npm install @repo/x402-sui-sdk @mysten/sui
# or
bun add @repo/x402-sui-sdk @mysten/sui
```

## Quick Start

### Server-Side

```typescript
import { createX402Server } from '@repo/x402-sui-sdk';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// Initialize
const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });
const sponsorKeypair = Ed25519Keypair.fromSecretKey(/* ... */);

const x402Server = createX402Server({
  suiClient: client,
  packageId: '0xYOUR_PACKAGE_ID',
  sponsorKeypair, // Optional: for gasless transactions
});

// Generate x402 response
const response = await x402Server.generateX402Response(
  {
    id: 'content_1',
    title: 'Premium Article',
    price: '100000000', // 0.1 SUI in MIST
    creator: '0xCREATOR_ADDRESS',
    // ... other fields
  },
  buyerAddress
);

// Returns:
// {
//   statusCode: 402,
//   message: 'Payment Required',
//   paymentRequired: {
//     amount: '100000000',
//     recipient: '0xCREATOR_ADDRESS',
//     transactionBytes: 'base64_encoded_ptb',
//     description: 'Purchase access to: Premium Article'
//   }
// }

// Execute signed transaction
const result = await x402Server.sponsorAndExecute(
  transactionBytes,
  clientSignature,
  clientPublicKey
);

console.log('Transaction:', result.digest);
```

### Client-Side

```typescript
import { createX402Client } from '@repo/x402-sui-sdk';
import { SuiClient } from '@mysten/sui/client';

// Initialize
const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' });

const x402Client = createX402Client({
  suiClient: client,
  packageId: '0xYOUR_PACKAGE_ID',
});

// Handle x402 flow
const digest = await x402Client.handleX402Flow(
  'https://api.example.com',
  'content_1',
  keypair
);

console.log('Purchase complete:', digest);

// Check access
const hasAccess = await x402Client.checkAccess(
  userAddress,
  'content_1'
);

// Get all receipts
const receipts = await x402Client.getAccessReceipts(userAddress);
```

### Browser/Wallet Integration

```typescript
import { useSignTransaction, useCurrentAccount } from '@mysten/dapp-kit';

function PurchaseButton({ contentId }) {
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();

  const handlePurchase = async () => {
    // 1. Get x402 response
    const response = await fetch(`/api/content/${contentId}?address=${account.address}`);
    const x402 = await response.json();

    // 2. Sign transaction
    const txBytes = Buffer.from(x402.paymentRequired.transactionBytes, 'base64');
    const { signature } = await signTransaction({ transaction: txBytes });

    // 3. Submit to server
    const result = await fetch(`/api/content/${contentId}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        transactionBytes: x402.paymentRequired.transactionBytes,
        signature,
        publicKey: account.publicKey,
      }),
    });

    console.log('Success!', await result.json());
  };

  return <button onClick={handlePurchase}>Purchase</button>;
}
```

## API Reference

### Server SDK

#### `createX402Server(config)`

Creates a new x402 server instance.

**Parameters:**
```typescript
{
  suiClient: SuiClient;        // Sui client instance
  packageId: string;           // Deployed Move package ID
  sponsorKeypair?: Ed25519Keypair;  // Optional: for gasless txs
  contentModule?: string;      // Default: 'content_access'
}
```

#### `generateX402Response(content, buyerAddress)`

Generates an HTTP 402 response with PTB.

**Returns:** `Promise<X402Response>`

#### `sponsorAndExecute(txBytes, signature, publicKey)`

Sponsors and executes a client-signed transaction.

**Returns:** `Promise<TransactionResult>`

#### `createContent(title, description, price, url, creatorKeypair)`

Creates new premium content on-chain.

**Returns:** `Promise<string>` (content object ID)

#### `getContentDetails(contentObjectId)`

Fetches content metadata from chain.

**Returns:** `Promise<ContentMetadata | null>`

#### `hasAccess(ownerAddress, contentId)`

Checks if an address owns access to content.

**Returns:** `Promise<boolean>`

### Client SDK

#### `createX402Client(config)`

Creates a new x402 client instance.

**Parameters:**
```typescript
{
  suiClient: SuiClient;
  packageId: string;
  moduleName?: string;  // Default: 'content_access'
}
```

#### `parseX402Response(response)`

Parses and validates an x402 response.

**Returns:** Payment details object

#### `signWithKeypair(transactionBytes, keypair)`

Signs a transaction using a keypair (for automation).

**Returns:** `Promise<SignedTransactionRequest>`

#### `signWithWallet(transactionBytes, wallet)`

Signs a transaction using a browser wallet.

**Returns:** `Promise<SignedTransactionRequest>`

#### `submitSignedTransaction(serverUrl, contentId, signedTx)`

Submits signed transaction to server.

**Returns:** `Promise<{ digest: string; status: string }>`

#### `handleX402Flow(serverUrl, contentId, keypair)`

Complete automated flow for AI agents/scripts.

**Returns:** `Promise<string>` (transaction digest)

#### `checkAccess(userAddress, contentId)`

Checks if user has access to content.

**Returns:** `Promise<boolean>`

#### `getAccessReceipts(userAddress)`

Gets all access receipts owned by address.

**Returns:** `Promise<AccessReceiptData[]>`

#### `waitForTransaction(digest, timeoutMs?)`

Waits for transaction confirmation.

**Returns:** `Promise<boolean>`

## Types

### X402Response

```typescript
{
  statusCode: 402;
  message: string;
  paymentRequired: {
    amount: string;
    recipient: string;
    transactionBytes: string;
    description: string;
  };
}
```

### ContentMetadata

```typescript
{
  id: string;
  title: string;
  description: string;
  price: string;
  contentUrl: string;
  creator: string;
}
```

### AccessReceiptData

```typescript
{
  id: string;
  contentId: string;
  contentTitle: string;
  pricePaid: string;
  purchaser: string;
  timestamp: string;
}
```

## Advanced Usage

### Custom PTBs

```typescript
const tx = await x402Server.buildPurchaseTransaction({
  contentObjectId: '0xCONTENT_ID',
  price: '100000000',
  creator: '0xCREATOR',
  buyerAddress: '0xBUYER',
});

// Add custom logic
tx.moveCall({
  target: `${packageId}::custom::extra_logic`,
  arguments: [/* ... */],
});

// Execute
const txBytes = await tx.build({ client });
```

### Error Handling

```typescript
try {
  const result = await x402Server.sponsorAndExecute(txBytes, sig, pubKey);
  if (result.status === 'failure') {
    console.error('Transaction failed:', result.effects);
  }
} catch (error) {
  if (error.message.includes('Insufficient gas')) {
    // Handle gas error
  } else if (error.message.includes('Insufficient payment')) {
    // Handle payment error
  }
}
```

### Gasless Transactions

To enable gasless transactions for better UX:

```typescript
const sponsorKeypair = Ed25519Keypair.fromSecretKey(sponsorPrivateKey);

const x402Server = createX402Server({
  suiClient: client,
  packageId: '0xPACKAGE_ID',
  sponsorKeypair, // Server pays gas!
});
```

Users sign the transaction, but the server pays the gas fees.

## Best Practices

1. **Validate prices**: Always verify payment amounts match expected prices
2. **Error handling**: Implement comprehensive error handling
3. **Rate limiting**: Add rate limits to prevent abuse
4. **Signature verification**: Never trust client-provided data
5. **Gas budgets**: Set appropriate gas budgets for transactions
6. **Timeouts**: Implement timeouts for long-running operations

## Security Considerations

- Store private keys securely (use environment variables, key management systems)
- Validate all user inputs
- Implement proper access control
- Use HTTPS in production
- Monitor for unusual activity
- Keep dependencies updated

## Examples

See the `apps/` directory for complete examples:
- `apps/server`: Express/Hono API server
- `apps/web`: Next.js frontend with wallet integration

## Testing

```typescript
import { describe, test, expect } from 'bun:test';

describe('x402 SDK', () => {
  test('generates valid x402 response', async () => {
    const response = await x402Server.generateX402Response(content, buyer);
    expect(response.statusCode).toBe(402);
    expect(response.paymentRequired.transactionBytes).toBeTruthy();
  });
});
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT

## Support

- [Documentation](../../README.md)
- [Issues](https://github.com/yourorg/x402-sui/issues)
- [Sui Discord](https://discord.gg/sui)

## Changelog

### v0.1.0 (Initial Release)
- Server SDK with PTB construction
- Client SDK with transaction signing
- x402 response generation
- Access verification
- Type definitions
