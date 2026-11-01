"use client";

import { Lottie } from "lottie-react";
import { confettiAnimation } from "@/lib/confetti-lottie";

export function GiveawayConfetti({ reduced }: { reduced: boolean }) {
  return (
    <Lottie
      src={confettiAnimation}
      autoplay={!reduced}
      loop={!reduced}
      aria-hidden={true}
      className={"h-full w-full"}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        pointerEvents: "none",
      }}
    />
  );
}
