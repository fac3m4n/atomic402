/**
 * x402 Server SDK
 * Build programmable transaction blocks (PTBs) and generate x402 responses
 */

import { SuiClient, SuiTransactionBlockResponse } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type {
  X402Response,
  ContentMetadata,
  TransactionResult,
} from "@repo/shared/types";

export interface ServerConfig {
  suiClient: SuiClient;
  packageId: string;
  sponsorKeypair?: Ed25519Keypair; // Optional: for gasless transactions
  contentModule?: string; // Default: 'content_access'
}

export interface PurchaseParams {
  contentObjectId: string;
  price: string; // Amount in MIST
  creator: string; // Content creator address
  buyerAddress: string; // Who's buying
  clockObjectId?: string; // Sui clock object (0x6)
}

/**
 * X402 Server SDK
 * Constructs PTBs for atomic payment + action and generates x402 responses
 */
export class X402Server {
  private client: SuiClient;
  private packageId: string;
  private sponsorKeypair?: Ed25519Keypair;
  private moduleName: string;

  constructor(config: ServerConfig) {
    this.client = config.suiClient;
    this.packageId = config.packageId;
    this.sponsorKeypair = config.sponsorKeypair;
    this.moduleName = config.contentModule || "content_access";
  }

  /**
   * Build a PTB for purchasing content and granting access atomically
   * This is the core of x402 on Sui - payment and action in ONE transaction
   */
  async buildPurchaseTransaction(params: PurchaseParams): Promise<Transaction> {
    const tx = new Transaction();

    // 1. Split coin for exact payment
    const [coin] = tx.splitCoins(tx.gas, [params.price]);

    // 2. Call purchase_and_grant_access function
    // This atomically:
    // - Transfers payment to creator
    // - Mints AccessReceipt NFT to buyer
    tx.moveCall({
      target: `${this.packageId}::${this.moduleName}::purchase_and_grant_access`,
      arguments: [
        tx.object(params.contentObjectId), // content: &ContentItem
        coin, // payment: Coin<SUI>
        tx.object(params.clockObjectId || "0x6"), // clock: &Clock
      ],
    });

    // Set sender (buyer)
    tx.setSender(params.buyerAddress);

    // If we have a sponsor, set gas payment
    if (this.sponsorKeypair) {
      tx.setGasOwner(this.sponsorKeypair.toSuiAddress());
    }

    return tx;
  }

  /**
   * Generate x402 response with PTB transaction bytes
   * Client will sign this and send back
   */
  async generateX402Response(
    content: ContentMetadata,
    buyerAddress: string
  ): Promise<X402Response> {
    // Build the transaction
    const tx = await this.buildPurchaseTransaction({
      contentObjectId: content.id,
      price: content.price,
      creator: content.creator,
      buyerAddress,
    });

    // Serialize transaction to bytes
    const transactionBytes = await tx.build({ client: this.client });
    const base64Tx = Buffer.from(transactionBytes).toString("base64");

    return {
      statusCode: 402,
      message: "Payment Required",
      paymentRequired: {
        amount: content.price,
        recipient: content.creator,
        transactionBytes: base64Tx,
        description: `Purchase access to: ${content.title}`,
      },
    };
  }

  /**
   * Sponsor and execute a transaction signed by the client
   * Server adds its signature and submits to Sui network
   */
  async sponsorAndExecute(
    transactionBytes: string,
    clientSignature: string,
    clientPublicKey: string
  ): Promise<TransactionResult> {
    if (!this.sponsorKeypair) {
      throw new Error("Sponsor keypair required for transaction execution");
    }

    try {
      // Decode transaction bytes
      const txBytes = Buffer.from(transactionBytes, "base64");

      // Execute transaction with both signatures
      // Client signature authorizes the action
      // Sponsor signature pays for gas
      const sponsorSig = await this.sponsorKeypair.signTransaction(txBytes);
      const result: SuiTransactionBlockResponse =
        await this.client.executeTransactionBlock({
          transactionBlock: txBytes,
          signature: [clientSignature, sponsorSig.signature],
          options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
          },
        });

      return {
        digest: result.digest,
        status:
          result.effects?.status?.status === "success" ? "success" : "failure",
        effects: result.effects,
      };
    } catch (error) {
      console.error("Transaction execution failed:", error);
      throw error;
    }
  }

  /**
   * Helper: Create new content (for content providers)
   */
  async createContent(
    title: string,
    description: string,
    price: string,
    contentUrl: string,
    creatorKeypair: Ed25519Keypair
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.packageId}::${this.moduleName}::create_content`,
      arguments: [
        tx.pure.string(title),
        tx.pure.string(description),
        tx.pure.u64(price),
        tx.pure.string(contentUrl),
      ],
    });

    tx.setSender(creatorKeypair.toSuiAddress());

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: creatorKeypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // Extract created content object ID
    const createdObjects = result.effects?.created || [];
    const contentObject = createdObjects.find(
      (obj) =>
        obj.owner && typeof obj.owner === "object" && "Shared" in obj.owner
    );

    if (!contentObject) {
      throw new Error("Failed to create content object");
    }

    return contentObject.reference.objectId;
  }

  /**
   * Helper: Query content details from chain
   */
  async getContentDetails(
    contentObjectId: string
  ): Promise<ContentMetadata | null> {
    try {
      const obj = await this.client.getObject({
        id: contentObjectId,
        options: { showContent: true },
      });

      if (!obj.data?.content || obj.data.content.dataType !== "moveObject") {
        return null;
      }

      const fields = obj.data.content.fields as any;

      return {
        id: contentObjectId,
        title: this.decodeString(fields.title),
        description: this.decodeString(fields.description),
        price: fields.price,
        contentUrl: this.decodeString(fields.content_url),
        creator: fields.creator,
      };
    } catch (error) {
      console.error("Failed to fetch content:", error);
      return null;
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
   * Helper: Check if address owns access receipt for content
   */
  async hasAccess(ownerAddress: string, contentId: string): Promise<boolean> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: ownerAddress,
        filter: {
          StructType: `${this.packageId}::${this.moduleName}::AccessReceipt`,
        },
        options: { showContent: true },
      });

      // Check if any receipt matches the content ID
      return objects.data.some((obj) => {
        if (obj.data?.content && obj.data.content.dataType === "moveObject") {
          const fields = obj.data.content.fields as any;
          return fields.content_id === contentId;
        }
        return false;
      });
    } catch (error) {
      console.error("Access check failed:", error);
      return false;
    }
  }
}

/**
 * Factory function for easy initialization
 */
export function createX402Server(config: ServerConfig): X402Server {
  return new X402Server(config);
}
