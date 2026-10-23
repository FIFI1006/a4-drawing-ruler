import { useCallback, useRef, useState } from "react";
import { newProject, type Project } from "./model";
export function useProject() {
  const [project, setProject] = useState<Project>(newProject);
  const ref = useRef(project);
  const past = useRef<Project[]>([]),
    future = useRef<Project[]>([]);
  const [, redraw] = useState(0);
  const apply = useCallback((next: Project) => {
    ref.current = next;
    setProject(next);
  }, []);
  const update = useCallback(
    (fn: (p: Project) => Project, record = true) => {
      const old = ref.current;
      const next = fn(old);
      if (next === old) return;
      if (record) {
        past.current.push(old);
        if (past.current.length > 70) past.current.shift();
        future.current = [];
      }
      apply(next);
      redraw((n) => n + 1);
    },
    [apply],
  );
  const record = useCallback((before: Project) => {
    if (JSON.stringify(before) !== JSON.stringify(ref.current)) {
      past.current.push(before);
      if (past.current.length > 70) past.current.shift();
      future.current = [];
      redraw((n) => n + 1);
    }
  }, []);
  const undo = useCallback(() => {
    const p = past.current.pop();
    if (p) {
      future.current.push(ref.current);
      apply(p);
      redraw((n) => n + 1);
    }
  }, [apply]);
  const redo = useCallback(() => {
    const p = future.current.pop();
    if (p) {
      past.current.push(ref.current);
      apply(p);
      redraw((n) => n + 1);
    }
  }, [apply]);
  const replace = useCallback(
    (p: Project) => {
      apply(p);
      past.current = [];
      future.current = [];
      redraw((n) => n + 1);
    },
    [apply],
  );
  return {
    project,
    ref,
    update,
    record,
    undo,
    redo,
    replace,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
