"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Lock, Unlock, Loader2, ExternalLink } from "lucide-react";
import type { ContentMetadata } from "@repo/shared/types";
import {
  useCurrentAccount,
  useSignTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";

interface ContentCardProps {
  content: ContentMetadata;
  hasAccess?: boolean;
  onPurchase: (contentId: string) => Promise<void>;
}

export function ContentCard({
  content,
  hasAccess,
  onPurchase,
}: ContentCardProps) {
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [actualContent, setActualContent] = useState<string | null>(null);
  const account = useCurrentAccount();

  const priceInSui = (parseInt(content.price) / 1_000_000_000).toFixed(2);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      await onPurchase(content.id);
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("Purchase failed: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleView = async () => {
    if (!account?.address) return;

    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/content/${content.id}?address=${account.address}`
      );

      if (response.ok) {
        const data = await response.json();
        setActualContent(data.data.content);
        setViewing(true);
      }
    } catch (error) {
      console.error("Failed to fetch content:", error);
    } finally {
      setLoading(false);
    }
  };

  if (viewing && actualContent) {
    return (
      <Card className="hover:shadow-lg transition-shadow border-green-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-green-600" />
              <CardTitle className="text-xl">{content.title}</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewing(false)}
            >
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {actualContent}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {hasAccess ? (
              <Unlock className="w-5 h-5 text-green-600" />
            ) : (
              <Lock className="w-5 h-5 text-gray-400" />
            )}
            <CardTitle className="text-xl">{content.title}</CardTitle>
          </div>
          {hasAccess && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
              Owned
            </span>
          )}
        </div>
        <CardDescription>{content.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Price</span>
          <span className="text-2xl font-bold text-blue-600">
            {priceInSui} SUI
          </span>
        </div>
      </CardContent>
      <CardFooter>
        {!account ? (
          <Button disabled className="w-full">
            Connect Wallet to Purchase
          </Button>
        ) : hasAccess ? (
          <Button
            onClick={handleView}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "View Content"
            )}
          </Button>
        ) : (
          <Button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Purchase Access"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
