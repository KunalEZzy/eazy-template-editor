import { create } from "zustand";

import type { EditorActions } from "./editor.actions";
import type { EditorState } from "./editor.types";

const initialState: EditorState = {
  template: null,

  templateLoadVersion: 0,

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
    set((state) => ({
      template,

      templateLoadVersion:
        state.templateLoadVersion + 1,

      selectedBoxId: null,

      isDirty: false,

      error: null,
    })),

  selectBox: (selectedBoxId) =>
    set({
      selectedBoxId,
    }),

  updateTextBox: (boxId, changes) =>
    set((state) => {
      if (!state.template) {
        return state;
      }

      const boxes = state.template.boxes.map((box) => {
        if (box.id !== boxId) {
          return box;
        }

        if (box.type !== "text") {
          return box;
        }

        return {
          ...box,
          ...changes,
        };
      });

      return {
        template: {
          ...state.template,
          boxes,
          updatedAt: new Date().toISOString(),
        },

        isDirty: true,
      };
    }),

  updateBoxTransform: (boxId, changes) =>
    set((state) => {
      if (!state.template) {
        return state;
      }

      const boxes = state.template.boxes.map((box) => {
        if (box.id !== boxId) {
          return box;
        }

        return {
          ...box,
          ...changes,
        };
      });

      return {
        template: {
          ...state.template,
          boxes,
          updatedAt: new Date().toISOString(),
        },

        isDirty: true,
      };
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