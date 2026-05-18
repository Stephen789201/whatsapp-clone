import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import HomeScreen from "./components/HomePage";
import UserDetails from "./components/UserDetails";
import StatusPage from "./page/StatusSection/StatusPage";
import Login from "./page/user-login/Login";
import { ProtectedRoute, PublicRoute } from './Protected';
import Setting from './page/SettingSection/Seetings';
import { useChatStore } from './store/chatStore';
import userStore from './store/useUserStore';
import useLayoutStore from './store/layoutStore';
import { getSocket, disconnectSocket, initializeSocket } from './services/chat.service';
import VideoCallManager from './page/VideoCall/VideoCallManager';

function App() {
  const { setCurrentUser, initSocketListeners, cleanup, conversations } = useChatStore()
  const { user } = userStore()
  const { setSelectedContact, selectedContact } = useLayoutStore()

  useEffect(() => {
    // Initialize socket when user is logged in
    if (user?._id) {
      const socket = initializeSocket()

      if (socket) {
        // Set current user in chat store
        setCurrentUser(user)

        // Initialize socket listeners
        initSocketListeners()
      }
    }

    // Cleanup on unmount
    return () => {
      cleanup()
      disconnectSocket()
    }
  }, [user?._id, setCurrentUser, initSocketListeners, cleanup])

  // Keep chat store's user data in sync with profile updates
  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user, setCurrentUser]);

  // Restore selectedContact from persisted ID on refresh
  useEffect(() => {
    if (user?._id && !selectedContact && conversations) {
      const persistedId = useLayoutStore.getState().selectedContactId;
      if (persistedId) {
        const list = Array.isArray(conversations) ? conversations : (conversations?.data || []);
        const conversation = list.find(conv => 
          conv.participants?.some(p => String(p._id || p) === String(persistedId))
        );
        
        const contact = conversation?.participants?.find(p => 
          String(p._id || p) === String(persistedId)
        );

        if (contact) {
          console.log("Restoring selected contact from persistence:", contact.username);
          setSelectedContact(contact);
        }
      }
    }
  }, [user?._id, conversations, selectedContact, setSelectedContact]);
 
  const socket = getSocket();

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      {socket && <VideoCallManager socket={socket} />}
      <Router>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/user-login" element={<Login />} />
          </Route>
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/user-details" element={<UserDetails />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/setting" element={< Setting/>} />
          </Route>
        </Routes>
      </Router>
    </>
  );
}

export default App;