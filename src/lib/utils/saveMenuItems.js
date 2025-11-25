import { savePNG, saveJPEG, saveSVG, savePDF } from "./save.js";
import {
  shareLink,
  shareToTwitter,
  copyImage,
  shareImage,
} from "./share.js";

export const saveMenuItems = [
  { label: "Save PNG", action: savePNG },
  { label: "Save JPEG", action: saveJPEG },
  { label: "Save SVG", action: saveSVG },
  { label: "Save PDF", action: savePDF },
  { separator: true },
  { label: "Copy Link", action: shareLink },
  { label: "Copy Image", action: copyImage },
  { label: "Share to Twitter", action: shareToTwitter },
  { label: "Share Image", action: shareImage },
];
