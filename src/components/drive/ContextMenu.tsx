import React, { useEffect, useRef } from "react";
import { DriveFile, DriveFolder } from "services/drive.service";
import { Icon } from "components/Icon";

export type ContextMenuAction =
  | "open"
  | "rename"
  | "move"
  | "delete"
  | "download";

interface ContextMenuProps {
  item: DriveFile | DriveFolder;
  kind: "file" | "folder";
  position: { x: number; y: number };
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
}

interface MenuEntry {
  action: ContextMenuAction;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  destructive?: boolean;
  fileOnly?: boolean;
}

const ENTRIES: MenuEntry[] = [
  { action: "open", label: "開啟", icon: Icon.eye },
  { action: "download", label: "下載", icon: Icon.download, fileOnly: true },
  { action: "rename", label: "重新命名", icon: Icon.edit },
  { action: "move", label: "移動到…", icon: Icon.expand },
  { action: "delete", label: "刪除", icon: Icon.trash, destructive: true },
];

export const ContextMenu: React.FC<ContextMenuProps> = ({ kind, position, onAction, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleDoc);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleDoc);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // 讓 menu 不超過 viewport
  const style: React.CSSProperties = {
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 240),
  };

  return (
    <div className="drive-ctxmenu" style={style} ref={ref} role="menu">
      {ENTRIES.filter((e) => !(e.fileOnly && kind === "folder")).map((e) => {
        const I = e.icon;
        return (
          <button
            type="button"
            key={e.action}
            className={`drive-ctxmenu-item ${e.destructive ? "drive-ctxmenu-item-destructive" : ""}`}
            onClick={() => onAction(e.action)}
            role="menuitem"
          >
            <I size={14} />
            <span>{e.label}</span>
          </button>
        );
      })}
    </div>
  );
};
