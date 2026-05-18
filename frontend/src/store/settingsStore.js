import { create } from "zustand";
import { persist } from "zustand/middleware";

const useSettingsStore = create(
  persist(
    (set) => ({
      // Default WhatsApp background (subtle cream/gray)
      chatWallpaper: {
        type: "color",
        value: "#f1ece5", // Default light
        darkValue: "#0b141a", // Default dark
        hasPattern: true // This will trigger the CSS doodle pattern
      },

      setChatWallpaper: (wallpaper) => set({ chatWallpaper: wallpaper }),
      
      resetWallpaper: () => set({ 
        chatWallpaper: {
          type: "color",
          value: "#f1ece5",
          darkValue: "#111b21"
        } 
      }),
    }),
    {
      name: "neurochat-settings",
    }
  )
);

export default useSettingsStore;
