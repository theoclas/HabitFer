import { Drawer } from "antd";
import type { ReactNode } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import "../features/habits/EmojiPicker.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  extra?: ReactNode;
  children: ReactNode;
  width?: number;
};

export function FormDrawer({ open, onClose, title, extra, children, width = 440 }: Props) {
  const isMobile = useIsMobile();

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      placement={isMobile ? "bottom" : "right"}
      width={isMobile ? "100%" : width}
      height={isMobile ? "min(85dvh, 620px)" : undefined}
      rootClassName={isMobile ? "habit-form-drawer" : undefined}
      styles={{
        body: {
          paddingBottom: isMobile ? "max(24px, env(safe-area-inset-bottom))" : 24,
          paddingLeft: isMobile ? "max(16px, env(safe-area-inset-left))" : undefined,
          paddingRight: isMobile ? "max(16px, env(safe-area-inset-right))" : undefined,
          overflowX: "hidden",
          overflowY: "auto",
        },
        wrapper: isMobile ? { maxWidth: "100vw" } : undefined,
      }}
      extra={extra}
    >
      {children}
    </Drawer>
  );
}
