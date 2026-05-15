import { create } from "zustand";
import {
  listTrash,
  restoreFile,
  permanentDeleteFile,
  TrashedFile,
  PagedMeta,
  SortKey,
  SortOrder,
} from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";

export interface TrashViewOpts {
  sort?: SortKey;
  order?: SortOrder;
  page?: number;
  size?: number;
}

interface TrashState {
  items: TrashedFile[];
  meta: PagedMeta | null;
  viewOpts: TrashViewOpts;
  loading: boolean;
  error: string | null;
}

interface TrashActions {
  fetchPage: (opts?: TrashViewOpts) => Promise<void>;
  restore: (fileId: number) => Promise<void>;
  permanentDelete: (fileId: number) => Promise<{ released_bytes: number }>;
  reset: () => void;
}

const initialState: TrashState = {
  items: [],
  meta: null,
  viewOpts: { sort: "updated_at", order: "desc", page: 1, size: 30 },
  loading: false,
  error: null,
};

// concurrent fetch race guard — 對齊 folderTreeStore (wiki #197 finding F)
let generation = 0;

export const useTrashStore = create<TrashState & TrashActions>((set, get) => {
  const fetchPage = async (opts: TrashViewOpts = {}) => {
    const merged: TrashViewOpts = { ...get().viewOpts, ...opts };
    const myGen = ++generation;
    set({ viewOpts: merged, loading: true, error: null });
    try {
      const { items, meta } = await listTrash(merged);
      if (myGen !== generation) return;
      set({ items, meta, loading: false });
    } catch (err) {
      if (myGen !== generation) return;
      set({ loading: false, error: mapDriveError(err) });
    }
  };

  const restore = async (fileId: number) => {
    // optimistic remove — 還原成功就從 trash 列表消失
    const before = get().items;
    set({ items: before.filter((f) => f.id !== fileId), error: null });
    try {
      await restoreFile(fileId);
    } catch (err) {
      set({ items: before, error: mapDriveError(err) });
      throw err;
    }
  };

  const permanentDelete = async (fileId: number) => {
    const before = get().items;
    set({ items: before.filter((f) => f.id !== fileId), error: null });
    try {
      const result = await permanentDeleteFile(fileId);
      return result;
    } catch (err) {
      set({ items: before, error: mapDriveError(err) });
      throw err;
    }
  };

  return {
    ...initialState,
    fetchPage,
    restore,
    permanentDelete,
    reset: () => set({ ...initialState }),
  };
});
