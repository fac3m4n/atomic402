// Shared types
export type ApiResponse<T> = {
  data?: T;
  error?: string;
  success: boolean;
};

// x402 Protocol Types
export interface X402Response {
  statusCode: 402;
  message: string;
  paymentRequired: {
    amount: string; // Amount in MIST (smallest unit)
    recipient: string; // Sui address
    transactionBytes: string; // Base64 encoded transaction
    description: string;
  };
}

export interface ContentMetadata {
  id: string;
  title: string;
  description: string;
  price: string; // In MIST
  contentUrl: string;
  creator: string;
}

export interface AccessReceiptData {
  id: string;
  contentId: string;
  contentTitle: string;
  pricePaid: string;
  purchaser: string;
  timestamp: string;
}

export interface SignedTransactionRequest {
  transactionBytes: string;
  signature: string;
  publicKey: string;
}

export interface TransactionResult {
  digest: string;
  status: "success" | "failure";
  effects?: any;
}
