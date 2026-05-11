import React, { useEffect, useRef } from "react";
import { DriveFile, DriveFolder } from "services/drive.service";
import { Icon } from "components/Icon";
import { useDialogEsc } from "hooks/useDialogEsc";

export type ContextMenuAction =
  | "open"
  | "rename"
  | "move"
  | "delete"
  | "download"
  | "share";

interface ContextMenuProps {
  item: DriveFile | DriveFolder;
  kind: "file" | "folder";
  position: { x: number; y: number };
  /**
   * 若此 resource 是別人 share 給我（borrowed），permission 是 'read' or 'write'。
   * undefined = 自己擁有，所有 op 都 enabled。
   *
   * Mental model（wiki spec rule §11）：「act IN」 ≠ 「manage identity OF」
   * - borrowed read file: rename/move/delete/share 全 disable
   * - borrowed write file: rename/move/delete enabled, share 仍 disable (只 owner 可分享)
   * - borrowed read folder: 全 disable
   * - borrowed write folder: identity ops (rename/move/delete) disable
   *   (in-folder ops 不在此 contextmenu 範圍 — 是 child item 各自判斷)
   */
  borrowedPermission?: "read" | "write";
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
  { action: "share", label: "分享…", icon: Icon.link },
  { action: "rename", label: "重新命名", icon: Icon.edit },
  { action: "move", label: "移動到…", icon: Icon.expand },
  { action: "delete", label: "刪除", icon: Icon.trash, destructive: true },
];

function actionDisabledInfo(
  action: ContextMenuAction,
  kind: "file" | "folder",
  borrowedPermission: "read" | "write" | undefined,
): { disabled: boolean; tooltip?: string } {
  const isBorrowed = borrowedPermission !== undefined;
  const isReadOnly = borrowedPermission === "read";

  // open / download — 純讀，borrowed read 也 OK
  if (action === "open" || action === "download") {
    return { disabled: false };
  }

  // share — 永遠 owner-only
  if (action === "share") {
    if (isBorrowed) {
      return { disabled: true, tooltip: "只能由擁有者分享" };
    }
    return { disabled: false };
  }

  // rename / move / delete
  if (!isBorrowed) {
    return { disabled: false };
  }

  if (kind === "file") {
    if (isReadOnly) {
      return { disabled: true, tooltip: "此檔案唯讀" };
    }
    return { disabled: false };
  }

  // folder identity ops 永遠 owner-only by design
  // (Task 2 backend `0615cd9` finding A clarify: write share grantee 只能 act IN folder)
  if (isReadOnly) {
    return { disabled: true, tooltip: "此資料夾唯讀" };
  }
  return { disabled: true, tooltip: "資料夾本身需擁有者修改" };
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  kind,
  position,
  borrowedPermission,
  onAction,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useDialogEsc(onClose);
  useEffect(() => {
    const handleDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleDoc);
    return () => document.removeEventListener("mousedown", handleDoc);
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
        const { disabled, tooltip } = actionDisabledInfo(
          e.action,
          kind,
          borrowedPermission,
        );
        return (
          <button
            type="button"
            key={e.action}
            className={`drive-ctxmenu-item ${e.destructive ? "drive-ctxmenu-item-destructive" : ""}`}
            onClick={() => {
              if (!disabled) onAction(e.action);
            }}
            disabled={disabled}
            title={tooltip}
            role="menuitem"
            aria-disabled={disabled}
          >
            <I size={14} />
            <span>{e.label}</span>
          </button>
        );
      })}
    </div>
  );
};
