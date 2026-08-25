import { create } from "zustand";

import type { EditorActions } from "./editor.actions";
import type { EditorState } from "./editor.types";

const initialState: EditorState = {
  template: null,

  selectedBoxId: null,

  zoom: 1,

  panX: 0,
  panY: 0,

  activePanel: null,

  isDirty: false,

  isLoading: false,
  isSaving: false,

  error: null,
};

export const useEditorStore = create<
  EditorState & EditorActions
>((set) => ({
  ...initialState,

  setTemplate: (template) =>
    set({
      template,
      isDirty: false,
      error: null,
    }),

  selectBox: (selectedBoxId) =>
    set({
      selectedBoxId,
    }),

  setZoom: (zoom) =>
    set({
      zoom,
    }),

  setPan: (panX, panY) =>
    set({
      panX,
      panY,
    }),

  setActivePanel: (activePanel) =>
    set({
      activePanel,
    }),

  markDirty: () =>
    set({
      isDirty: true,
    }),

  markClean: () =>
    set({
      isDirty: false,
    }),

  setLoading: (isLoading) =>
    set({
      isLoading,
    }),

  setSaving: (isSaving) =>
    set({
      isSaving,
    }),

  setError: (error) =>
    set({
      error,
    }),

  resetEditor: () =>
    set({
      ...initialState,
    }),
}));