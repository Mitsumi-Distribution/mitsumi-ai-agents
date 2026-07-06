import { useMemo } from "react";
import { useParams } from "react-router-dom";

export function useAgent(defaultAgent = "sales") {
  const params = useParams();
  const name = useMemo(() => params.name ?? defaultAgent, [params.name, defaultAgent]);
  return { name };
}
