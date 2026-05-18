import { create } from "zustand"
import { persist } from "zustand/middleware"

const useStore = create(
    persist(
      (set) => ({
        activeTab: 'chats',
        selectedContact: null, // Keep the object in memory for active use
        setSelectedContact: (contact) => {
          // SAFETY: Prevent selecting oneself as a contact
          try {
            const userStore = JSON.parse(localStorage.getItem('user-storage'));
            const loggedInUserId = userStore?.state?.user?._id;
            const targetId = contact?._id || contact;
            
            if (loggedInUserId && String(loggedInUserId) === String(targetId)) {
              console.warn("Blocking self-selection in store");
              return;
            }
          } catch (e) {}

          set({ selectedContact: contact });
        },
        setActiveTab: (tab) => {set({ activeTab: tab })},
        clearLayout: () => set({ activeTab: 'chats', selectedContact: null }),
        }),
      {
        name: "whatsapp-storage",
        getStorage: () => localStorage,
        partialize: (state) => ({ 
          activeTab: state.activeTab,
          selectedContactId: state.selectedContact?._id || state.selectedContact 
        }),
      }
    )
  );
export default useStore