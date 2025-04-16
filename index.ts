import { SnapSaveDownloaderResponse } from "./types";
import { SnapSaverService } from "./Download";

// Create singleton instance
const snapSaverInstance = new SnapSaverService();

/**
 * Main function to download media from social platforms via SnapSave
 * @param url URL of the social media post to download
 * @returns Response containing success status and download data
 */
export const SnapSaver = async (url: string): Promise<SnapSaveDownloaderResponse> => {
  return snapSaverInstance.download(url);
};

