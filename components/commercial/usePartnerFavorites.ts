"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FAVORITES_UPDATED_EVENT,
  FavoriteAuthError,
  addPartnerFavorite,
  clearLegacyFavoriteStorage,
  fetchPartnerFavorites,
  removePartnerFavorite,
  type FavoriteSpace,
} from "@/lib/favorite-spaces";
import { subscribeAuthSessionChanged } from "@/lib/auth-client";

type AuthStatus = "loading" | "guest" | "mitra" | "non-mitra";

type AuthPrompt = {
  mode: "guest" | "non-mitra";
  redirectPath: string;
  roleLabel: string;
};

type VerifyResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    role: string;
  };
};

function formatRoleLabel(role?: string) {
  if (role === "ADMIN") return "Admin";
  if (role === "EDITOR") return "Editor";
  return role || "Internal";
}

export function buildPendingFavoriteRedirect(
  spaceId: string,
  options?: { ensureUnitParam?: boolean }
): string {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  if (options?.ensureUnitParam) {
    url.searchParams.set("unit", spaceId);
  }
  url.searchParams.set("pendingFavorite", spaceId);
  return `${url.pathname}${url.search}`;
}

export function usePartnerFavorites(options?: { pendingTargetSpaceId?: string }) {
  const pendingTargetSpaceId = options?.pendingTargetSpaceId;
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [roleLabel, setRoleLabel] = useState("");
  const [favorites, setFavorites] = useState<FavoriteSpace[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [busySpaceId, setBusySpaceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authPrompt, setAuthPrompt] = useState<AuthPrompt | null>(null);
  const handledPendingRef = useRef<string | null>(null);

  const loadSessionAndFavorites = useCallback(async (): Promise<AuthStatus> => {
    clearLegacyFavoriteStorage();
    try {
      const verifyRes = await fetch("/api/auth/verify", { cache: "no-store" });
      if (!verifyRes.ok) {
        setAuthStatus("guest");
        setFavorites([]);
        setFavoritesLoaded(true);
        return "guest";
      }
      const verify = (await verifyRes.json()) as VerifyResponse;
      if (!verify.authenticated || !verify.user) {
        setAuthStatus("guest");
        setFavorites([]);
        setFavoritesLoaded(true);
        return "guest";
      }

      if (verify.user.role !== "MITRA") {
        setAuthStatus("non-mitra");
        setRoleLabel(formatRoleLabel(verify.user.role));
        setFavorites([]);
        setFavoritesLoaded(true);
        return "non-mitra";
      }

      setAuthStatus("mitra");
      const result = await fetchPartnerFavorites();
      if (result.kind === "ready") {
        setFavorites(result.items);
      } else {
        setFavorites([]);
      }
      setFavoritesLoaded(true);
      return "mitra";
    } catch {
      setAuthStatus("guest");
      setFavoritesLoaded(true);
      return "guest";
    }
  }, []);

  useEffect(() => {
    // Jadwalkan pembacaan awal lewat microtask agar tidak memicu setState sinkron di effect.
    queueMicrotask(() => {
      void loadSessionAndFavorites();
    });

    const handleSync = () => {
      void loadSessionAndFavorites();
    };
    window.addEventListener(FAVORITES_UPDATED_EVENT, handleSync);
    const unsubscribeAuth = subscribeAuthSessionChanged(handleSync);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, handleSync);
      unsubscribeAuth();
    };
  }, [loadSessionAndFavorites]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.spaceId)),
    [favorites]
  );

  // Jika mitra baru kembali dari `/login?redirect=...&pendingFavorite=<id>`, langsung simpan otomatis.
  useEffect(() => {
    if (authStatus !== "mitra" || !favoritesLoaded || typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const pendingId = url.searchParams.get("pendingFavorite")?.trim();
    if (!pendingId) return;
    if (pendingTargetSpaceId && pendingId !== pendingTargetSpaceId) return;
    if (handledPendingRef.current === pendingId) return;
    handledPendingRef.current = pendingId;

    url.searchParams.delete("pendingFavorite");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

    let cancelled = false;
    void (async () => {
      if (favoriteIds.has(pendingId)) {
        if (!cancelled) setNotice("Unit sudah tersimpan di daftar Favorit Anda.");
        return;
      }

      setBusySpaceId(pendingId);
      setError("");
      try {
        const saved = await addPartnerFavorite(pendingId);
        if (cancelled) return;
        setFavorites((prev) =>
          prev.some((item) => item.spaceId === saved.spaceId) ? prev : [saved, ...prev]
        );
        setNotice("Unit berhasil disimpan ke Favorit akun Mitra Anda.");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Gagal menyimpan unit favorit.");
      } finally {
        if (!cancelled) setBusySpaceId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, favoritesLoaded, favoriteIds, pendingTargetSpaceId]);

  const toggleFavorite = useCallback(
    async (spaceId: string, redirectOptions?: { ensureUnitParam?: boolean }) => {
      if (busySpaceId) return;
      setError("");
      setNotice("");

      let currentStatus = authStatus;
      if (currentStatus === "loading") {
        currentStatus = await loadSessionAndFavorites();
      }

      if (currentStatus === "guest") {
        setAuthPrompt({
          mode: "guest",
          redirectPath: buildPendingFavoriteRedirect(spaceId, redirectOptions),
          roleLabel: "",
        });
        return;
      }

      if (currentStatus === "non-mitra") {
        setAuthPrompt({
          mode: "non-mitra",
          redirectPath: "/",
          roleLabel,
        });
        return;
      }

      const currentlySaved = favoriteIds.has(spaceId);
      setBusySpaceId(spaceId);
      try {
        if (currentlySaved) {
          await removePartnerFavorite(spaceId);
          setFavorites((prev) => prev.filter((item) => item.spaceId !== spaceId));
          setNotice("Unit dihapus dari daftar Favorit.");
        } else {
          const saved = await addPartnerFavorite(spaceId);
          setFavorites((prev) =>
            prev.some((item) => item.spaceId === saved.spaceId) ? prev : [saved, ...prev]
          );
          setNotice("Unit disimpan ke Favorit akun Mitra Anda.");
        }
      } catch (err) {
        if (err instanceof FavoriteAuthError) {
          if (err.status === 401) {
            setAuthStatus("guest");
            setAuthPrompt({
              mode: "guest",
              redirectPath: buildPendingFavoriteRedirect(spaceId, redirectOptions),
              roleLabel: "",
            });
          } else {
            setAuthStatus("non-mitra");
            setAuthPrompt({
              mode: "non-mitra",
              redirectPath: "/",
              roleLabel,
            });
          }
          return;
        }
        setError(err instanceof Error ? err.message : "Favorit gagal diperbarui.");
      } finally {
        setBusySpaceId(null);
      }
    },
    [authStatus, busySpaceId, favoriteIds, loadSessionAndFavorites, roleLabel]
  );

  return {
    favorites,
    favoriteIds,
    busySpaceId,
    error,
    notice,
    clearMessages: () => {
      setError("");
      setNotice("");
    },
    authPrompt,
    closeAuthPrompt: () => setAuthPrompt(null),
    toggleFavorite,
  };
}
