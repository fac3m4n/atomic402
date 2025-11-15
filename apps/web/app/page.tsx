"use client";

import { useState } from "react";
import { Header } from "./components/Header";
import { ContentCard } from "./components/ContentCard";
import { useCurrentAccount, useSignTransaction } from "@mysten/dapp-kit";
import type { ContentMetadata, X402Response } from "@repo/shared/types";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card } from "./components/ui/card";
import { useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function Home() {
  const [txStatus, setTxStatus] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();

  // Fetch available content with TanStack Query
  const { data: contentsData, isLoading: contentsLoading } = useQuery<
    ContentMetadata[]
  >({
    queryKey: ["contents"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/content`);
      const data = await response.json();
      return data.data || [];
    },
  });

  // Check owned content when wallet connects with TanStack Query
  const { data: ownedContentData, refetch: refetchOwnedContent } = useQuery<
    string[]
  >({
    queryKey: ["ownedContent", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];

      const response = await fetch(`${API_URL}/receipts/${account.address}`);
      const data = await response.json();

      if (data.success) {
        return data.data.map((r: { contentId: string }) => r.contentId);
      }
      return [];
    },
    enabled: !!account?.address,
  });

  const contents = contentsData || [];
  const ownedContent = new Set<string>(ownedContentData || []);
  const loading = contentsLoading;

  const handlePurchase = async (contentId: string) => {
    if (!account?.address) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      setTxStatus({ message: "Requesting payment details...", type: "info" });

      // Step 1: Request content (will get 402 response)
      const response = await fetch(
        `${API_URL}/content/${contentId}?address=${account.address}`
      );

      if (response.status !== 402) {
        throw new Error("Expected 402 Payment Required response");
      }

      const x402Response: X402Response = await response.json();

      setTxStatus({ message: "Waiting for signature...", type: "info" });

      // Step 2: Sign the transaction
      // Pass the base64 string directly - the wallet will handle decoding
      const { signature } = await signTransaction({
        transaction: x402Response.paymentRequired.transactionBytes,
      });

      setTxStatus({ message: "Submitting transaction...", type: "info" });

      // Step 3: Submit signed transaction to server
      const executeResponse = await fetch(
        `${API_URL}/content/${contentId}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionBytes: x402Response.paymentRequired.transactionBytes,
            signature: signature,
            publicKey: account.publicKey,
          }),
        }
      );

      const result = await executeResponse.json();

      if (result.success) {
        setTxStatus({
          message: `Success! Transaction: ${result.data.digest.slice(0, 8)}...`,
          type: "success",
        });

        // Refresh owned content using TanStack Query refetch
        setTimeout(() => {
          refetchOwnedContent();
          setTxStatus(null);
        }, 3000);
      } else {
        throw new Error(result.error || "Transaction failed");
      }
    } catch (error) {
      console.error("Purchase error:", error);
      setTxStatus({
        message: `Error: ${error instanceof Error ? error.message : "Purchase failed"}`,
        type: "error",
      });

      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Premium Content Marketplace
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience the future of payments on Sui. Purchase content with
            atomic payment + access grant in a single transaction.
          </p>
        </div>

        {/* Transaction Status */}
        {txStatus && (
          <Card
            className={`mb-6 p-4 ${
              txStatus.type === "success"
                ? "bg-green-50 border-green-200"
                : txStatus.type === "error"
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {txStatus.type === "success" && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
              {txStatus.type === "error" && (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              {txStatus.type === "info" && (
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              )}
              <span
                className={`font-medium ${
                  txStatus.type === "success"
                    ? "text-green-900"
                    : txStatus.type === "error"
                      ? "text-red-900"
                      : "text-blue-900"
                }`}
              >
                {txStatus.message}
              </span>
            </div>
          </Card>
        )}

        {/* Content Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-muted-foreground">
              Loading content...
            </span>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contents.map((content) => (
              <ContentCard
                key={content.id}
                content={content}
                hasAccess={ownedContent.has(content.id)}
                onPurchase={handlePurchase}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
