import { create } from 'zustand';
import axiosInstance from '../services/url.service';
import { toast } from 'react-toastify';

const useFriendStore = create((set, get) => ({
    friends: [],
    pendingRequests: [],
    loading: false,

    fetchFriends: async () => {
        set({ loading: true });
        try {
            const { data } = await axiosInstance.get('/friends/list');
            set({ friends: data.data || [], loading: false });
        } catch (error) {
            console.error("Error fetching friends:", error);
            set({ loading: false });
        }
    },

    fetchPendingRequests: async () => {
        set({ loading: true });
        try {
            const { data } = await axiosInstance.get('/friends/requests');
            set({ pendingRequests: data.data || [], loading: false });
        } catch (error) {
            console.error("Error fetching requests:", error);
            set({ loading: false });
        }
    },

    sendRequest: async (receiverId) => {
        try {
            await axiosInstance.post('/friends/send', { receiverId });
            toast.success("Friend request sent!");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to send request");
        }
    },

    respondToRequest: async (requestId, status) => {
        try {
            await axiosInstance.post('/friends/respond', { requestId, status });
            toast.success(`Request ${status}`);
            get().fetchPendingRequests();
            if (status === 'accepted') {
                get().fetchFriends();
            }
        } catch (error) {
            toast.error("Failed to respond to request");
        }
    }
}));

export default useFriendStore;
