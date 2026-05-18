import { io } from "socket.io-client";
import useUserStore from "../store/useUserStore";

let socket = null;


export const initializeSocket = () => {
  if (socket) {
    const user = useUserStore.getState().user;
    if (user?._id && socket.connected) {
      console.log("Socket already connected, re-emitting user_connected");
      socket.emit("user_connected", user._id);
    }
    return socket;
  }

  const user = useUserStore.getState().user;
  
  if (!user?._id) {
    console.log("No user ID found, socket not initialized");
    return null;
  }

  const BACKEND_URL = process.env.REACT_APP_API_URL;
  console.log("Initializing socket connection to:", BACKEND_URL);
  
  socket = io(BACKEND_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Connection events
  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    // Re-fetch user to ensure we have the latest ID
    const currentUser = useUserStore.getState().user;
    if (currentUser?._id) {
      console.log("Emitting user_connected for:", currentUser._id);
      socket.emit("user_connected", currentUser._id);
    }
  });

  // If already connected for some reason (e.g. fast reconnection), emit immediately
  if (socket.connected && user?._id) {
    socket.emit("user_connected", user._id);
  }

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initializeSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
