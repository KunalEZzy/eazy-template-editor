import { create } from "zustand";

import type { EditorActions } from "./editor.actions";
import type { EditorState } from "./editor.types";
import type { TextBox, QRBox, } from "../domain/box/box.types";
import type { TextVariable, QRVariable, } from "../domain/variables/variables.types";
import { VARIABLE_DEFINITIONS, } from "../domain/variables/variable.definitions";

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

    updateQRBox: (boxId, changes) =>
  set((state) => {
    if (!state.template) {
      return state;
    }

    const boxes =
      state.template.boxes.map(
        (box) => {
          if (box.id !== boxId) {
            return box;
          }

          if (box.type !== "qr") {
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
        updatedAt:
          new Date().toISOString(),
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

    setTemporaryBackgroundImage: (imageUrl) =>
    set({
        temporaryBackgroundImageUrl: imageUrl,
        isDirty: true,
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

      addVariable: (
    variable: TextVariable | QRVariable
  ) =>
    set((state) => {
      if (!state.template) {
        return state;
      }

      const variableDefinition =
        VARIABLE_DEFINITIONS.find(
          (definition) =>
            definition.key === variable
        );

      if (!variableDefinition) {
        return state;
      }

      const boxId = `box-${variable}-${Date.now()}`;

      const existingBoxes =
        state.template.boxes;

      const highestZIndex =
        existingBoxes.reduce(
          (max, box) =>
            Math.max(max, box.zIndex),
          0
        );

      const baseBox = {
        id: boxId,

        x: 10,
        y: 10,

        width: 30,
        height: 10,

        rotation: 0,
        opacity: 1,

        zIndex: highestZIndex + 1,

        locked: false,
        visible: true,
      };

      let newBox: TextBox | QRBox;

      if (variableDefinition.type === "text") {
        newBox = {
          ...baseBox,

          type: "text",

          variable: variableDefinition.key,

          fontFamily: "Arial",
          fontSize: 32,
          fontWeight: 400,

          color: "#000000",

          textAlign: "left",

          textTransform: "none",

          lineHeight: 1.2,
          letterSpacing: 0,
        };
      } else {
        newBox = {
          ...baseBox,

          type: "qr",

          variable: variableDefinition.key,

          width: 20,
          height: 20,

          foregroundColor: "#000000",
          backgroundColor: "#FFFFFF",
        };
      }


      console.log(
        "ADDING VARIABLE:",
        variable,
        newBox
    );

      return {
        template: {
          ...state.template,

          boxes: [
            ...state.template.boxes,
            newBox,
          ],

          updatedAt:
            new Date().toISOString(),
        },

        selectedBoxId: boxId,

        isDirty: true,
      };
    }),
}));