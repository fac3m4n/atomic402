"use client";

import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { Coins } from "lucide-react";

export function Header() {
  const account = useCurrentAccount();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-linear-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <Coins className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">x402 on Sui</h1>
              <p className="text-sm text-muted-foreground">
                Atomic Payment + Access Protocol
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  );
}
