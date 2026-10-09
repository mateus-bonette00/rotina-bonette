import { useQuery } from "@tanstack/react-query";
import { api, setCsrf } from "../lib/api";

export type SessionResponse = {
  authenticated: boolean;
  user: { id: string; name: string; lastLoginAt: string | null } | null;
  csrfToken: string | null;
};

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const data = await api<SessionResponse>("/auth/session");
      setCsrf(data.csrfToken);
      return data;
    },
  });
}
