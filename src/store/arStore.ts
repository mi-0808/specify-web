import { create } from "zustand";

export interface MeasurementPoint {
  x: number;
  y: number;
  z: number;
}

export interface ARMeasurement {
  corners: [MeasurementPoint, MeasurementPoint, MeasurementPoint, MeasurementPoint];
  width_cm: number;
  depth_cm: number;
  height_cm: number;
  capturedAt: Date;
}

interface ARStore {
  isSessionActive: boolean;
  measurement: ARMeasurement | null;
  tappedPoints: MeasurementPoint[];
  setSessionActive: (active: boolean) => void;
  addTappedPoint: (point: MeasurementPoint) => void;
  setMeasurement: (m: ARMeasurement) => void;
  reset: () => void;
}

export const useARStore = create<ARStore>((set) => ({
  isSessionActive: false,
  measurement: null,
  tappedPoints: [],
  setSessionActive: (active) => set({ isSessionActive: active }),
  addTappedPoint: (point) =>
    set((state) => ({
      tappedPoints: [...state.tappedPoints.slice(-3), point],
    })),
  setMeasurement: (measurement) => set({ measurement }),
  reset: () => set({ isSessionActive: false, measurement: null, tappedPoints: [] }),
}));
