"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Register failed");
        return;
      }

      window.localStorage.setItem("username", data.user.username);
      router.push("/");
    } catch (err) {
      console.error(err);
      toast.error("Register error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050816] text-slate-100 flex items-center justify-center px-5 py-10">

      <div className="w-full max-w-md space-y-8">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-white drop-shadow-lg tracking-wide">
          Create Account
        </h1>

        {/* Form */}
        <form className="space-y-5" onSubmit={onSubmit}>
          {/* Username */}
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white rounded-lg h-11"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-900 border-slate-700 text-white rounded-lg h-11"
              required
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full h-11 rounded-lg bg-emerald-500 text-black font-semibold shadow-[0_0_18px_rgba(16,185,129,0.6)] hover:bg-emerald-400"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Register"}
          </Button>
        </form>

        {/* Login Link */}
        <p className="text-xs text-center text-slate-400 mt-2">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/login")}
            className="text-emerald-400 hover:underline font-semibold"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
}
