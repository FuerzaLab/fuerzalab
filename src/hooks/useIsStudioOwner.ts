import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { isStudioOwner } from "../services/studio";

let cached: { userId: string; value: Promise<boolean> } | null = null;

/** ¿El usuario actual es el dueño de su estudio? (Solo puede serlo un entrenador.) */
export function useIsStudioOwner(): boolean {
  const { profile } = useAuth();
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    if (!profile || profile.role !== "trainer") {
      setOwner(false);
      return;
    }
    if (!cached || cached.userId !== profile.id) cached = { userId: profile.id, value: isStudioOwner() };
    let alive = true;
    cached.value.then((v) => alive && setOwner(v));
    return () => {
      alive = false;
    };
  }, [profile]);
  return owner;
}
