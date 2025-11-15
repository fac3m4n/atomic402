"use client";

import { Header } from "./components/Header";
import { ContentCard } from "./components/ContentCard";
import { useCurrentAccount, useSignTransaction } from "@mysten/dapp-kit";
import type { ContentMetadata, X402Response } from "@repo/shared/types";
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";

export default function Home() {
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const queryClient = useQueryClient();

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
  const {
    data: ownedContentData,
    isLoading: ownedContentLoading,
    refetch: refetchOwnedContent,
  } = useQuery<string[]>({
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

  // Show loading state until both contents and owned content (if wallet connected) are loaded
  const isLoadingData =
    contentsLoading || (account?.address && ownedContentLoading);

  const handlePurchase = async (contentId: string) => {
    if (!account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    const toastId = toast.loading("Requesting payment details...");

    try {
      // Step 1: Request content (will get 402 response)
      const response = await fetch(
        `${API_URL}/content/${contentId}?address=${account.address}`
      );

      if (response.status !== 402) {
        throw new Error("Expected 402 Payment Required response");
      }

      const x402Response: X402Response = await response.json();

      toast.loading("Waiting for wallet signature...", { id: toastId });

      // Step 2: Sign the transaction
      // Pass the base64 string directly - the wallet will handle decoding
      const { signature } = await signTransaction({
        transaction: x402Response.paymentRequired.transactionBytes,
      });

      toast.loading("Submitting transaction to blockchain...", { id: toastId });

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
        const explorerUrl = `https://suiscan.xyz/${NETWORK}/tx/${result.data.digest}`;

        toast.success(
          <div className="flex items-center gap-2">
            <span>Purchase successful!</span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              View on Explorer
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>,
          { id: toastId, duration: 5000 }
        );

        // Optimistically update the cache immediately
        queryClient.setQueryData<string[]>(
          ["ownedContent", account.address],
          (old) => {
            const current = old || [];
            return current.includes(contentId)
              ? current
              : [...current, contentId];
          }
        );

        // Refetch after a short delay to ensure blockchain state is settled
        setTimeout(async () => {
          await refetchOwnedContent();
        }, 1500);
      } else {
        throw new Error(result.error || "Transaction failed");
      }
    } catch (error) {
      console.error("Purchase error:", error);
      toast.error(error instanceof Error ? error.message : "Purchase failed", {
        id: toastId,
      });
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

        {/* Content Grid */}
        {isLoadingData ? (
          <div className="flex flex-col justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
            <span className="text-lg text-muted-foreground font-medium">
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
