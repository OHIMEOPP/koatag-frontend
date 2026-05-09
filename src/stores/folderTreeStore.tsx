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

export const useFolderTreeStore = create<FolderTreeState & FolderTreeActions>(
  (set, get) => ({
    ...initialState,

    setCurrent: async (id, opts) => {
      const nextOpts = { ...get().viewOpts, ...opts };
      set({ currentFolderId: id, viewOpts: nextOpts, loading: true, error: null });
      try {
        const view = await loadFolderView(id, nextOpts);
        set({
          folders: view.folders,
          files: view.files.items,
          filesMeta: view.files.meta,
          breadcrumb: view.breadcrumb,
          loading: false,
        });
      } catch (err) {
        set({ loading: false, error: mapDriveError(err) });
      }
    },

    setViewOpts: async (partial) => {
      const nextOpts = { ...get().viewOpts, ...partial };
      const id = get().currentFolderId;
      set({ viewOpts: nextOpts, loading: true, error: null });
      try {
        const view = await loadFolderView(id, nextOpts);
        set({
          folders: view.folders,
          files: view.files.items,
          filesMeta: view.files.meta,
          breadcrumb: view.breadcrumb,
          loading: false,
        });
      } catch (err) {
        set({ loading: false, error: mapDriveError(err) });
      }
    },

    invalidate: async () => {
      await get().setCurrent(get().currentFolderId, get().viewOpts);
    },

    reset: () => set({ ...initialState }),
  })
);
