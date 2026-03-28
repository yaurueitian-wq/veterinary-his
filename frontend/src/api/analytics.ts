import api from "@/api";

export interface TransitionEdge {
  from: string;
  to: string;
  count: number;
}

export interface CaseEvent {
  from: string;
  to: string;
  at: string | null;
}

export interface CaseData {
  visit_id: number;
  events: CaseEvent[];
}

export interface StatusStat {
  avg_minutes: number;
  filtered_avg_minutes: number;
  min_minutes: number;
  max_minutes: number;
  count: number;
  ok_count: number;
  exceeded_count: number;
  sop_threshold_minutes: number | null;
  sop_status: "ok" | "warning" | "exceeded" | null;
}

export interface VariantStat {
  path: string;
  count: number;
  visit_ids: number[];
}

export interface ProcessModel {
  dfg?: TransitionEdge[];
  start_activities?: Record<string, number>;
  end_activities?: Record<string, number>;
  fitness?: number;
  error?: string;
}

export interface Insight {
  level: "warning" | "info";
  visit_id: number | null;
  type: string;
  message: string;
  detail: string;
}

export interface ProcessMiningResult {
  total_cases: number;
  total_events: number;
  transitions: TransitionEdge[];
  cases: CaseData[];
  status_stats: Record<string, StatusStat>;
  variant_stats: VariantStat[];
  process_model: ProcessModel | null;
  insights: Insight[];
}

export const analyticsApi = {
  getProcessMining: (): Promise<ProcessMiningResult> =>
    api.get("/analytics/process-mining").then((r) => r.data),
};
