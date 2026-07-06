export type TaskRecord = {
  id: string;
  status: string;
  title: string;
};

export function useTask() {
  const tasks: TaskRecord[] = [
    { id: "seed-1", status: "running", title: "Quarterly DELL quote follow-up" },
    { id: "seed-2", status: "done", title: "Pipeline health summary" }
  ];
  return { tasks };
}
