import { useCallback, useEffect, useState } from "react";
import { fetchDepartmentOverview } from "../api/client";
import type { DepartmentKey, DepartmentOverview } from "../types";

type Params = { region?: string | null; country?: string | null };

type State = {
  data: DepartmentOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useDepartmentOverview(name: DepartmentKey, params: Params = {}): State {
  const [data, setData] = useState<DepartmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchDepartmentOverview(name, params);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, [name, params.region, params.country]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
