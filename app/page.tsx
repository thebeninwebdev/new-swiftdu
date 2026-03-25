"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [image, setImage] = useState("");

  const handleSignup = async () => {
    const { data, error } = await authClient.signUp.email(
      {
        email,
        password,
        name,
        image,
        callbackURL: "/dashboard",
      },
      {
        onRequest: () => {
          console.log("loading...");
        },
        onSuccess: () => {
          console.log("signup successful");
        },
        onError: (ctx) => {
          alert(ctx.error.message);
        },
      }
    );

    console.log(data, error);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col gap-3 w-80">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2"
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2"
        />

        <button
          onClick={handleSignup}
          className="bg-black text-white p-2 rounded"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}