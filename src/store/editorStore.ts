import { create } from "zustand";
import type { EditorActions } from "./editor.actions";
import type { EditorState } from "./editor.types";
import type { TextBox, QRBox } from "../domain/box/box.types";
import type { TextVariable, QRVariable } from "../domain/variables/variables.types";
import { VARIABLE_DEFINITIONS } from "../domain/variables/variable.definitions";
import { VARIABLE_DEFAULTS } from "../domain/variables/variable.defaults";
import { findAvailableBoxPlacement } from "../editor/placement/boxPlacement";
import type { Template } from "../domain/template/template.types";

const MAX_HISTORY = 50;
const cloneTemplate = (template: Template): Template => {
  return structuredClone(template);
};

const recordHistory = (
  state: EditorState,
  template: Template
): Pick<EditorState, "past" | "future"> => {
  const newPast = [...state.past, cloneTemplate(template)];

  return {
    past:
      newPast.length > MAX_HISTORY
        ? newPast.slice(-MAX_HISTORY)
        : newPast,
    future: [],
  };
};

const initialState: EditorState = {
  template: null,
  templateLoadVersion: 0,
  temporaryBackgroundImageUrl: null,
  selectedBoxId: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  activePanel: null,
  isDirty: false,
  isLoading: false,
  isSaving: false,
  error: null,
  past: [],
  future: [],
};

export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  ...initialState,

  // --------------------------------------------------
  // Template
  // --------------------------------------------------

setTemplate: (template) =>
  set((state) => ({
    template,
    templateLoadVersion:
      state.templateLoadVersion + 1,

    temporaryBackgroundImageUrl: null,

    selectedBoxId: null,

    isDirty: false,

    error: null,

    past: [],

    future: [],
  })),

  // --------------------------------------------------
  // Selection
  // --------------------------------------------------

  selectBox: (selectedBoxId) =>
    set({
      selectedBoxId,
    }),

  // --------------------------------------------------
  // Text Box
  // --------------------------------------------------

updateTextBox: (boxId, changes) =>
  set((state) => {
    if (!state.template) {
      return state;
    }

    const box = state.template.boxes.find(
      (box) => box.id === boxId
    );

    if (!box || box.type !== "text") {
      return state;
    }

    const history = recordHistory(
      state,
      state.template
    );

    const boxes = state.template.boxes.map(
      (box) => {
        if (box.id !== boxId) {
          return box;
        }

        return {
          ...box,
          ...changes,
        };
      }
    );

    return {
      template: {
        ...state.template,
        boxes,
        updatedAt: new Date().toISOString(),
      },

      ...history,

      isDirty: true,
    };
  }),

  // --------------------------------------------------
  // QR Box
  // --------------------------------------------------

updateQRBox: (boxId, changes) =>
  set((state) => {
    if (!state.template) {
      return state;
    }

    const box = state.template.boxes.find(
      (box) => box.id === boxId
    );

    if (!box || box.type !== "qr") {
      return state;
    }

    const history = recordHistory(
      state,
      state.template
    );

    const boxes = state.template.boxes.map(
      (box) => {
        if (box.id !== boxId) {
          return box;
        }

        return {
          ...box,
          ...changes,
        };
      }
    );

    return {
      template: {
        ...state.template,
        boxes,
        updatedAt: new Date().toISOString(),
      },

      ...history,

      isDirty: true,
    };
  }),

  // --------------------------------------------------
  // Generic Box Transform
  // --------------------------------------------------

updateBoxTransform: (boxId, changes) =>
  set((state) => {
    if (!state.template) {
      return state;
    }

    const boxExists = state.template.boxes.some(
      (box) => box.id === boxId
    );

    if (!boxExists) {
      return state;
    }

    const history = recordHistory(
      state,
      state.template
    );

    const boxes = state.template.boxes.map(
      (box) => {
        if (box.id !== boxId) {
          return box;
        }

        return {
          ...box,
          ...changes,
        };
      }
    );

    return {
      template: {
        ...state.template,
        boxes,
        updatedAt: new Date().toISOString(),
      },

      ...history,

      isDirty: true,
    };
  }),

  // --------------------------------------------------
  // Zoom
  // --------------------------------------------------

  setZoom: (zoom) =>
    set({
      zoom,
    }),

  // --------------------------------------------------
  // Pan
  // --------------------------------------------------

  setPan: (panX, panY) =>
    set({
      panX,
      panY,
    }),

  // --------------------------------------------------
  // Temporary Background
  // --------------------------------------------------

setTemporaryBackgroundImage: (imageUrl, dimensions) =>
  set((state) => {
    if (!state.template) {
      return {
        temporaryBackgroundImageUrl: imageUrl,
        isDirty: true,
      };
    }

    const history = recordHistory(
      state,
      state.template
    );

    const updatedSettings = dimensions
      ? {
          ...state.template.settings,
          canvasWidth: dimensions.width,
          canvasHeight: dimensions.height,
        }
      : state.template.settings;

    return {
      ...history,

      temporaryBackgroundImageUrl: imageUrl,

      template: {
        ...state.template,
        settings: updatedSettings,
        updatedAt: new Date().toISOString(),
      },

      isDirty: true,
    };
  }),

  // --------------------------------------------------
  // Active Panel
  // --------------------------------------------------

  setActivePanel: (activePanel) =>
    set({
      activePanel,
    }),

  // --------------------------------------------------
  // Dirty State
  // --------------------------------------------------

  markDirty: () =>
    set({
      isDirty: true,
    }),

  markClean: () =>
    set({
      isDirty: false,
    }),

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  setLoading: (isLoading) =>
    set({
      isLoading,
    }),

  // --------------------------------------------------
  // Saving
  // --------------------------------------------------

  setSaving: (isSaving) =>
    set({
      isSaving,
    }),

  // --------------------------------------------------
  // Error
  // --------------------------------------------------

  setError: (error) =>
    set({
      error,
    }),

  // --------------------------------------------------
  // Reset
  // --------------------------------------------------

  resetEditor: () =>
    set({
      ...initialState,
    }),

  // --------------------------------------------------
  // Add Variable
  // --------------------------------------------------

  addVariable: (variable: TextVariable | QRVariable) =>
    set((state) => {
      if (!state.template) {
        return state;
      }

      const variableDefinition = VARIABLE_DEFINITIONS.find(
        (definition) => definition.key === variable
      );

      if (!variableDefinition) {
        return state;
      }

      const variableDefaults = VARIABLE_DEFAULTS[variable];

      if (!variableDefaults) {
        return state;
      }

      const boxId = `box-${variable}-${Date.now()}`;
      const existingBoxes = state.template.boxes;

      const highestZIndex = existingBoxes.reduce(
        (max, box) => Math.max(max, box.zIndex),
        0
      );

      const placement = findAvailableBoxPlacement(
        existingBoxes,
        {
          x: variableDefaults.x,
          y: variableDefaults.y,
        },
        variableDefaults.width,
        variableDefaults.height
      );

      let newBox: TextBox | QRBox;

      if (variableDefinition.type === "text") {
        if (variableDefaults.type !== "text") {
          return state;
        }

        newBox = {
          id: boxId,
          type: "text",
          variable: variableDefinition.key,
          x: placement.x,
          y: placement.y,
          width: variableDefaults.width,
          height: variableDefaults.height,
          rotation: 0,
          opacity: 1,
          zIndex: highestZIndex + 1,
          locked: false,
          visible: true,
          fontFamily: variableDefaults.fontFamily,
          fontSize: variableDefaults.fontSize,
          fontWeight: variableDefaults.fontWeight,
          color: variableDefaults.color,
          textAlign: variableDefaults.textAlign,
          textTransform: variableDefaults.textTransform,
          lineHeight: variableDefaults.lineHeight,
          letterSpacing: variableDefaults.letterSpacing,
        };
      } else {
        if (variableDefaults.type !== "qr") {
          return state;
        }

        newBox = {
          id: boxId,
          type: "qr",
          variable: variableDefinition.key,
          x: placement.x,
          y: placement.y,
          width: variableDefaults.width,
          height: variableDefaults.height,
          rotation: 0,
          opacity: 1,
          zIndex: highestZIndex + 1,
          locked: false,
          visible: true,
          foregroundColor: variableDefaults.foregroundColor,
          backgroundColor: variableDefaults.backgroundColor,
        };
      }

      const history = recordHistory(state, state.template);

      return {
        ...history,
        template: {
          ...state.template,
          boxes: [...state.template.boxes, newBox],
          updatedAt: new Date().toISOString(),
        },
        selectedBoxId: boxId,
        isDirty: true,
      };
    }),

  // --------------------------------------------------
  // Delete Box
  // --------------------------------------------------

  deleteBox: (boxId) =>
    set((state) => {
      if (!state.template) {
        return state;
      }

      const boxExists = state.template.boxes.some((box) => box.id === boxId);
      if (!boxExists) {
        return state;
      }

      const history = recordHistory(state, state.template);
      const boxes = state.template.boxes.filter((box) => box.id !== boxId);

      return {
        template: {
          ...state.template,
          boxes,
          updatedAt: new Date().toISOString(),
        },
        ...history,
        selectedBoxId:
          state.selectedBoxId === boxId ? null : state.selectedBoxId,
        isDirty: true,
      };
    }),

  // --------------------------------------------------
  // Undo
  // --------------------------------------------------

  undo: () =>
    set((state) => {
      if (!state.template || state.past.length === 0) {
        return state;
      }

      const previousTemplate = state.past[state.past.length - 1];
      const remainingPast = state.past.slice(0, state.past.length - 1);

      return {
        past: remainingPast,
        future: [...state.future, cloneTemplate(state.template)],
        template: cloneTemplate(previousTemplate),
        templateLoadVersion: state.templateLoadVersion + 1,
        selectedBoxId: null,
        isDirty: true,
      };
    }),

  // --------------------------------------------------
  // Redo
  // --------------------------------------------------

  redo: () =>
    set((state) => {
      if (!state.template || state.future.length === 0) {
        return state;
      }

      const nextTemplate = state.future[state.future.length - 1];
      const remainingFuture = state.future.slice(0, state.future.length - 1);

      return {
        past: [...state.past, cloneTemplate(state.template)],
        future: remainingFuture,
        template: cloneTemplate(nextTemplate),
        templateLoadVersion: state.templateLoadVersion + 1,
        selectedBoxId: null,
        isDirty: true,
      };
    }),
}));