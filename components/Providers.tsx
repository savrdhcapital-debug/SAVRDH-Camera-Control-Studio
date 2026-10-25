"use client";

import type { ReactNode } from "react";
import StudioAdminBridge from "./StudioAdminBridge";
import { PrefsProvider } from "./PrefsProvider";
import { CameraProvider } from "./CameraProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <CameraProvider><StudioAdminBridge />{children}</CameraProvider>
    </PrefsProvider>
  );
}
