// hooks/useGeneration.ts
import { useEffect, useRef } from "react";
import { useAppStore } from "../store/useAppStore";
import { startGeneration, pollStatus, fetchResult } from "../services/api";

const POLL_INTERVAL_MS = 2000;

export function useGeneration() {
  const { generation, setJobId, setGenStatus, setTimetable } = useAppStore();
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollerRef.current) {
      clearInterval(pollerRef.current);
      pollerRef.current = null;
    }
  };

  const generate = async () => {
    stopPolling();
    setGenStatus("pending");
    try {
      const { job_id } = await startGeneration();
      setJobId(job_id);

      pollerRef.current = setInterval(async () => {
        try {
          const status = await pollStatus(job_id);
          setGenStatus(status.status, status.error);

          if (status.status === "done") {
            stopPolling();
            const result = await fetchResult(job_id);
            setTimetable({
              id: result.timetable_id,
              fitness: result.fitness,
              entries: result.entries,
            });
          } else if (status.status === "failed") {
            stopPolling();
          }
        } catch (e: any) {
          stopPolling();
          setGenStatus("failed", e.message);
        }
      }, POLL_INTERVAL_MS);
    } catch (e: any) {
      setGenStatus("failed", e.message);
    }
  };

  // Clean up on unmount
  useEffect(() => () => stopPolling(), []);

  return {
    generate,
    status: generation.status,
    error: generation.error,
    timetable: generation.timetable,
    isRunning:
      generation.status === "pending" || generation.status === "running",
  };
}
