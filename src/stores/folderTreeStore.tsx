import { create } from "zustand";
import {
  loadFolderView,
  DriveFile,
  DriveFolder,
  PagedMeta,
  SortKey,
  SortOrder,
} from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";

export interface FolderViewOpts {
  sort?: SortKey;
  order?: SortOrder;
  q?: string;
  page?: number;
  size?: number;
}

interface FolderTreeState {
  currentFolderId: number | null;
  folders: DriveFolder[];
  files: DriveFile[];
  filesMeta: PagedMeta | null;
  breadcrumb: DriveFolder[];
  viewOpts: FolderViewOpts;
  loading: boolean;
  error: string | null;
}

interface FolderTreeActions {
  setCurrent: (id: number | null, opts?: FolderViewOpts) => Promise<void>;
  setViewOpts: (opts: Partial<FolderViewOpts>) => Promise<void>;
  invalidate: () => Promise<void>;
  reset: () => void;
}

const initialState: FolderTreeState = {
  currentFolderId: null,
  folders: [],
  files: [],
  filesMeta: null,
  breadcrumb: [],
  viewOpts: { sort: "name", order: "asc", page: 1, size: 30 },
  loading: false,
  error: null,
};

// Generation counter 防 concurrent loadFolderView race (wiki review #197 finding F)：
// user 快速連點不同資料夾時，stale response 不應覆寫 latest state
let generation = 0;

export const useFolderTreeStore = create<FolderTreeState & FolderTreeActions>(
  (set, get) => {
    const load = async (id: number | null, opts: FolderViewOpts) => {
      const myGen = ++generation;
      set({ currentFolderId: id, viewOpts: opts, loading: true, error: null });
      try {
        const view = await loadFolderView(id, opts);
        if (myGen !== generation) return;
        set({
          folders: view.folders,
          files: view.files.items,
          filesMeta: view.files.meta,
          breadcrumb: view.breadcrumb,
          loading: false,
        });
      } catch (err) {
        if (myGen !== generation) return;
        set({ loading: false, error: mapDriveError(err) });
      }
    };

    return {
      ...initialState,
      setCurrent: (id, opts) => load(id, { ...get().viewOpts, ...opts }),
      setViewOpts: (partial) => load(get().currentFolderId, { ...get().viewOpts, ...partial }),
      invalidate: () => load(get().currentFolderId, get().viewOpts),
      reset: () => set({ ...initialState }),
    };
  }
);
