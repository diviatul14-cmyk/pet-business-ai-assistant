
"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "../match.module.css";

export default function MatchLoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/match`,
          },
        });

        if (error) throw error;

        if (data.session) {
          window.location.href = "/match";
          return;
        }

        setMessage("Registration successful! Please check your email to verify your account before signing in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        window.location.href = "/match";
        return;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/match`,
        },
      });

      if (error) throw error;

      setMessage("Magic login link sent! Please check your email.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to send login link."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authCard}>
        <Link href="/match" className={styles.authBrand}>
          PETORA <span>MATCH</span>
        </Link>

        <p className={styles.authEyebrow}>RESPONSIBLE ANIMAL MATCHING</p>

        <h1>
          {mode === "signup" ? "Join the PETORA family" : "Welcome back"}
        </h1>

        <p className={styles.authDescription}>
          Connect with responsible animal owners and find compatible
          companions for your animals.
        </p>

        <div className={styles.authTabs}>
          <button
            type="button"
            className={mode === "signup" ? styles.activeTab : ""}
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
          >
            Create account
          </button>

          <button
            type="button"
            className={mode === "login" ? styles.activeTab : ""}
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {mode === "signup" && (
            <label>
              Your name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={8}
              required
            />
          </label>

          <button
            type="submit"
            className={styles.authSubmit}
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "signup"
                ? "Create my account"
                : "Sign in"}
          </button>
        </form>

    {message && (
          <p className={styles.authSuccess} role="status">
            {message}
          </p>
        )}

        {error && (
          <p className={styles.authError} role="alert">
            {error}
          </p>
        )}

        <p className={styles.authFooter}>
          By continuing, you agree to use PETORA Match responsibly and
          prioritise animal welfare.
        </p>
      </section>
    </main>
  );
}
