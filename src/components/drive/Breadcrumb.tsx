import React from "react";
import { Icon } from "components/Icon";
import { DriveFolder } from "services/drive.service";

interface BreadcrumbProps {
  ancestors: DriveFolder[]; // root → current (含 current)
  onNavigate: (folderId: number | null) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ ancestors, onNavigate }) => {
  return (
    <nav className="drive-breadcrumb">
      <button
        type="button"
        className="drive-breadcrumb-item"
        onClick={() => onNavigate(null)}
      >
        <Icon.home size={14} />
        <span>Drive</span>
      </button>
      {ancestors.map((folder, i) => {
        const isLast = i === ancestors.length - 1;
        return (
          <React.Fragment key={folder.id}>
            <Icon.chevronRight size={12} className="drive-breadcrumb-sep" />
            {isLast ? (
              <span className="drive-breadcrumb-item drive-breadcrumb-current">
                {folder.name}
              </span>
            ) : (
              <button
                type="button"
                className="drive-breadcrumb-item"
                onClick={() => onNavigate(folder.id)}
              >
                {folder.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
