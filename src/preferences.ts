import { useEffect, useState } from "react";
import { z } from "zod";
import { gridSchema, newProject, type Grid } from "./model";

export const PREFERENCES_KEY = "a4-ui-preferences-v2";
export const themes = {
  classic: {
    name: "经典浅色",
    workspace: "#f0f3f2",
    paper: "#ffffff",
    surface: "#ffffff",
    ink: "#34433f",
    ruler: "#edf2ef",
    rulerInk: "#53675f",
  },
  soft: {
    name: "柔和护眼",
    workspace: "#a9b9ac",
    paper: "#f5f0da",
    surface: "#e8eee5",
    ink: "#304538",
    ruler: "#d5dfd0",
    rulerInk: "#3b5140",
  },
  night: {
    name: "深色夜间",
    workspace: "#191e22",
    paper: "#42484b",
    surface: "#272f33",
    ink: "#e2eae6",
    ruler: "#2d373c",
    rulerInk: "#d2e4da",
  },
  warm: {
    name: "暖色纸张",
    workspace: "#b9afa3",
    paper: "#f9edce",
    surface: "#f2eadd",
    ink: "#514535",
    ruler: "#e6d7be",
    rulerInk: "#675238",
  },
} as const;
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const preferencesSchema = z.object({
  theme: z.enum(["classic", "soft", "night", "warm"]),
  workspaceColor: hex,
  paperColor: hex,
  fullCrosshair: z.boolean(),
  magnifierEnabled: z.boolean(),
  magnifierZoom: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  labelsVisible: z.boolean(),
  labelCoordinates: z.boolean(),
  labelLeaders: z.boolean(),
  grid: gridSchema,
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = (): Preferences => ({
  theme: "classic",
  workspaceColor: themes.classic.workspace,
  paperColor: themes.classic.paper,
  fullCrosshair: false,
  magnifierEnabled: true,
  magnifierZoom: 4,
  labelsVisible: true,
  labelCoordinates: true,
  labelLeaders: true,
  grid: newProject().grid,
});
export function parsePreferences(value: unknown): Preferences {
  const base = defaultPreferences();
  if (!value || typeof value !== "object") return base;
  // Reject malformed individual fields without losing other valid preferences.
  const candidate = { ...base, ...value };
  for (const key of Object.keys(
    preferencesSchema.shape,
  ) as (keyof Preferences)[]) {
    if (!preferencesSchema.shape[key].safeParse(candidate[key]).success)
      Object.assign(candidate, { [key]: base[key] });
  }
  return preferencesSchema.parse(candidate);
}
export function readPreferences(): Preferences {
  try {
    return parsePreferences(
      JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "null"),
    );
  } catch {
    return defaultPreferences();
  }
}
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [preferences]);
  const patch = (p: Partial<Preferences>) =>
    setPreferences((old) => ({ ...old, ...p }));
  return { preferences, patchPreferences: patch, storageError };
}
export function darkColor(color: string) {
  const c = color.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45;
}
export function chooseTheme(theme: Preferences["theme"]): Partial<Preferences> {
  return {
    theme,
    workspaceColor: themes[theme].workspace,
    paperColor: themes[theme].paper,
  };
}
export function projectWithDefaults(grid: Grid) {
  return { ...newProject(), grid: { ...grid } };
}
