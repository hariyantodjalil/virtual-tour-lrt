"use client";

/**
 * Wrapper fetch untuk halaman CMS.
 *
 * Jika API mengembalikan 401 (sesi expired atau belum login),
 * otomatis redirect ke /cms/login dengan menyertakan URL saat ini
 * sebagai `redirect` param agar user bisa kembali ke halaman yang sama.
 */
export async function cmsFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    const currentPath =
      typeof window !== "undefined" ? window.location.pathname : "/cms/dashboard";
    const loginUrl = `/cms/login?redirect=${encodeURIComponent(currentPath)}&reason=expired`;
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    // Kembalikan response agar caller tidak throw, tapi caller harus cek .ok
    return response;
  }

  return response;
}
