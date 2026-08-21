"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { maskConfirmationCode } from "./validation";

export function ConfirmationCode({ code }: { code: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono tracking-wide">
        {revealed ? code : maskConfirmationCode(code)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto px-2 py-1 text-xs"
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? "Ocultar" : "Mostrar"}
      </Button>
    </span>
  );
}
