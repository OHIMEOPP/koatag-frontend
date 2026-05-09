import { create } from "zustand";
import { getQuota, DriveQuota } from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";

interface DriveQuotaState {
  quota: DriveQuota | null;
  loading: boolean;
  error: string | null;
}

interface DriveQuotaActions {
  fetch: () => Promise<void>;
  invalidate: () => Promise<void>;
  reset: () => void;
}

const initialState: DriveQuotaState = {
  quota: null,
  loading: false,
  error: null,
};

export const useDriveQuotaStore = create<DriveQuotaState & DriveQuotaActions>(
  (set) => {
    const refetch = async () => {
      set({ loading: true, error: null });
      try {
        const quota = await getQuota();
        set({ quota, loading: false });
      } catch (err) {
        set({ loading: false, error: mapDriveError(err) });
      }
    };

    return {
      ...initialState,
      fetch: refetch,
      invalidate: refetch,
      reset: () => set({ ...initialState }),
    };
  }
);
