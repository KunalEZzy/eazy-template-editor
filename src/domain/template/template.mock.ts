import type { Template } from "./template.types";

export const mockTemplate: Template = {
  id: "template-001",

  name: "Demo PayEazy Standee",

  code: "demo-payeazy-standee",

  campaign: "pay-eazy-standee",

    background: {
        imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80",
    },

  boxes: [
    {
      id: "box-restaurant-name",
      type: "text",

      variable: "resNameNL",

      x: 10,
      y: 10,
      width: 80,
      height: 10,

      rotation: 0,
      opacity: 1,

      zIndex: 1,

      locked: false,
      visible: true,

      fontFamily: "Arial",
      fontSize: 48,
      fontWeight: 700,

      color: "#000000",

      textAlign: "center",

      textTransform: "none",

      lineHeight: 1.2,
      letterSpacing: 0,
    },

    {
      id: "box-discount",
      type: "text",

      variable: "discount",

      x: 20,
      y: 30,
      width: 60,
      height: 12,

      rotation: 0,
      opacity: 1,

      zIndex: 2,

      locked: false,
      visible: true,

      fontFamily: "Arial",
      fontSize: 64,
      fontWeight: 700,

      color: "#FF0000",

      textAlign: "center",

      textTransform: "uppercase",

      lineHeight: 1.2,
      letterSpacing: 0,
    },

    {
      id: "box-location",
      type: "text",

      variable: "resLoc",

      x: 15,
      y: 45,
      width: 70,
      height: 8,

      rotation: 0,
      opacity: 1,

      zIndex: 3,

      locked: false,
      visible: true,

      fontFamily: "Arial",
      fontSize: 28,
      fontWeight: 400,

      color: "#333333",

      textAlign: "center",

      textTransform: "none",

      lineHeight: 1.2,
      letterSpacing: 0,
    },

    {
      id: "box-restaurant-qr",
      type: "qr",

      variable: "resQR",

      x: 35,
      y: 65,
      width: 30,
      height: 20,

      rotation: 0,
      opacity: 1,

      zIndex: 4,

      locked: false,
      visible: true,

      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
    },
  ],

  settings: {
    canvasWidth: 1200,
    canvasHeight: 1600,
    backgroundColor: "#FFFFFF",
    bleed: 0,
  },

  active: true,

  version: 1,

  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};