/**
 * x402 Client SDK
 * Handle x402 responses, sign transactions, and verify access
 */

import { SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type {
  X402Response,
  SignedTransactionRequest,
  AccessReceiptData,
} from "@repo/shared/types";

export interface ClientConfig {
  suiClient: SuiClient;
  packageId: string;
  moduleName?: string; // Default: 'content_access'
}

export interface WalletSigner {
  address: string;
  signTransaction: (
    txBytes: Uint8Array
  ) => Promise<{ signature: string; publicKey: string }>;
}

/**
 * X402 Client SDK
 * Handles x402 payment flow from client perspective
 */
export class X402Client {
  private client: SuiClient;
  private packageId: string;
  private moduleName: string;

  constructor(config: ClientConfig) {
    this.client = config.suiClient;
    this.packageId = config.packageId;
    this.moduleName = config.moduleName || "content_access";
  }

  /**
   * Parse and validate x402 response
   */
  parseX402Response(response: X402Response): {
    amount: string;
    recipient: string;
    transactionBytes: string;
    description: string;
  } {
    if (response.statusCode !== 402) {
      throw new Error("Invalid x402 response: status code must be 402");
    }

    if (!response.paymentRequired.transactionBytes) {
      throw new Error("Invalid x402 response: missing transaction bytes");
    }

    return response.paymentRequired;
  }

  /**
   * Sign transaction using a keypair (for testing/automation)
   */
  async signWithKeypair(
    transactionBytes: string,
    keypair: Ed25519Keypair
  ): Promise<SignedTransactionRequest> {
    const txBytes = Buffer.from(transactionBytes, "base64");
    const { signature } = await keypair.signTransaction(txBytes);

    return {
      transactionBytes,
      signature,
      publicKey: keypair.getPublicKey().toBase64(),
    };
  }

  /**
   * Sign transaction using a wallet (browser extension, etc.)
   */
  async signWithWallet(
    transactionBytes: string,
    wallet: WalletSigner
  ): Promise<SignedTransactionRequest> {
    const txBytes = Buffer.from(transactionBytes, "base64");
    const { signature, publicKey } = await wallet.signTransaction(txBytes);

    return {
      transactionBytes,
      signature,
      publicKey,
    };
  }

  /**
   * Submit signed transaction to server for sponsorship and execution
   */
  async submitSignedTransaction(
    serverUrl: string,
    contentId: string,
    signedTx: SignedTransactionRequest
  ): Promise<{ digest: string; status: string }> {
    const response = await fetch(`${serverUrl}/content/${contentId}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signedTx),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to execute transaction");
    }

    return response.json();
  }

  /**
   * Complete flow: handle x402, sign, and submit
   * For automated clients (AI agents, scripts)
   */
  async handleX402Flow(
    serverUrl: string,
    contentId: string,
    keypair: Ed25519Keypair
  ): Promise<string> {
    // 1. Request content (will get 402 response)
    const x402Response = await this.requestContent(serverUrl, contentId);

    // 2. Parse x402 response
    const payment = this.parseX402Response(x402Response);

    // 3. Sign transaction
    const signedTx = await this.signWithKeypair(
      payment.transactionBytes,
      keypair
    );

    // 4. Submit to server
    const result = await this.submitSignedTransaction(
      serverUrl,
      contentId,
      signedTx
    );

    // 5. Return transaction digest
    return result.digest;
  }

  /**
   * Request content from server (may return 402)
   */
  private async requestContent(
    serverUrl: string,
    contentId: string
  ): Promise<X402Response> {
    const response = await fetch(`${serverUrl}/content/${contentId}`, {
      method: "GET",
    });

    if (response.status === 402) {
      return response.json();
    }

    if (!response.ok) {
      throw new Error(`Failed to request content: ${response.statusText}`);
    }

    // If 200, user already has access
    throw new Error("User already has access to this content");
  }

  /**
   * Check if user has access to content
   */
  async checkAccess(userAddress: string, contentId: string): Promise<boolean> {
    try {
      const receipts = await this.getAccessReceipts(userAddress);
      return receipts.some((receipt) => receipt.contentId === contentId);
    } catch (error) {
      console.error("Access check failed:", error);
      return false;
    }
  }

  /**
   * Get all access receipts owned by user
   */
  async getAccessReceipts(userAddress: string): Promise<AccessReceiptData[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: userAddress,
        filter: {
          StructType: `${this.packageId}::${this.moduleName}::AccessReceipt`,
        },
        options: { showContent: true },
      });

      return objects.data
        .filter(
          (obj) =>
            obj.data?.content && obj.data.content.dataType === "moveObject"
        )
        .map((obj) => {
          const fields = obj.data!.content!.fields as Record<string, unknown>;
          return {
            id: obj.data!.objectId,
            contentId: String(fields.content_id),
            contentTitle: this.decodeString(fields.content_title as number[]),
            pricePaid: String(fields.price_paid),
            purchaser: String(fields.purchaser),
            timestamp: String(fields.timestamp),
          };
        });
    } catch (error) {
      console.error("Failed to fetch access receipts:", error);
      return [];
    }
  }

  /**
   * Helper: Decode vector<u8> to string
   */
  private decodeString(vec: number[]): string {
    if (Array.isArray(vec)) {
      return Buffer.from(vec).toString("utf8");
    }
    return String(vec);
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(
    digest: string,
    timeoutMs: number = 30000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.client.getTransactionBlock({
          digest,
          options: { showEffects: true },
        });

        if (result.effects?.status?.status === "success") {
          return true;
        }

        if (result.effects?.status?.status === "failure") {
          return false;
        }
      } catch (error) {
        // Transaction not found yet, continue waiting
      }

      // Wait 1 second before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Transaction confirmation timeout");
  }
}

/**
 * Factory function for easy initialization
 */
export function createX402Client(config: ClientConfig): X402Client {
  return new X402Client(config);
}
