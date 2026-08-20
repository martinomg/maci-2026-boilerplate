import type { ElementIdReport } from "@/lib/svg-validate";

/** Spot ids compared against the uploaded layout, plus the lot's spot total. */
export type LayoutMatchReport = ElementIdReport & {
  /** Spots of the lot that declare an `svg_element_id`. */
  mappedSpotCount: number;
  /** Total spots of the lot, mapped or not. */
  spotCount: number;
};

export type LayoutUploadResponse =
  | { ok: true; stage: "report"; report: LayoutMatchReport }
  | {
      ok: true;
      stage: "uploaded";
      report: LayoutMatchReport;
      fileId: string;
      previousFileId: string | null;
    }
  | { ok: false; message: string; code?: string };
