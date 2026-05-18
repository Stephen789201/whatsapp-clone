import React, { useState, useEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  FaVideo,
  FaArrowLeft,
  FaEllipsisV,
  FaPaperclip,
  FaPaperPlane,
  FaLock,
  FaSmile,
  FaImage,
  FaFile,
  FaTimes,
  FaMicrophone,
  FaTrash,
  FaCheck,
} from "react-icons/fa";
import MessageBubble from "./MessageBubble";
import EmojiPicker from "emoji-picker-react";
import useThemeStore from "../../store/themeStore";
import useUserStore from "../../store/useUserStore";
import useOutsideClick from "../../hooks/useOutsideClick";
import { useChatStore } from "../../store/chatStore";
import whatsappImage from "../../images/whatsapp_image.png";
import useVideoCallStore from "../../store/videoCallStore";
import VideoCallManager from "../VideoCall/VideoCallManager";
import { getSocket } from "../../services/chat.service";

const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date);
};

export default function ChatWindow({ selectedContact, setSelectedContact }) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Voice recording state & refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const { theme } = useThemeStore();
  const { user } = useUserStore();
  const socket = getSocket();
  const {
    messages,
    sendMessage,
    startTyping,
    stopTyping,
    isUserTyping,
    isUserOnline,
    getUserLastSeen,
    fetchMessages,
    fetchConversations,
    conversations,
    addReaction,
    deleteMessage,
    markMessagesAsRead,
  } = useChatStore();


  // Get online status and last seen
  const online = isUserOnline(selectedContact?._id);
  const lastSeen = getUserLastSeen(selectedContact?._id);
  const isTyping = isUserTyping(selectedContact?._id);

  useEffect(() => {
    if (selectedContact?._id) {
      const list = conversations?.data || conversations || [];
      if (list.length > 0) {
        const conversation = list.find((conv) =>
          conv.participants.some(
            (participant) => participant._id === selectedContact._id
          )
        );
        const activeConversationId = conversation?._id || null;
        const loadedConversationId = useChatStore.getState().currentConversation;

        if (activeConversationId) {
          if (loadedConversationId !== activeConversationId) {
            fetchMessages(activeConversationId);
          }
        } else {
          if (loadedConversationId !== null) {
            useChatStore.setState({ messages: [], currentConversation: null });
          }
        }
      }
    }
  }, [selectedContact, conversations, fetchMessages]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch messages when selected contact changes
  // useEffect(() => {
  //   if (selectedContact?._id && conversations?.data?.length > 0) {
  //     const conversation = conversations.data.find((conv) =>
  //       conv.participants.some(
  //         (participant) => participant._id === selectedContact._id
  //       )
  //     );
  //     if (conversation?._id) {
  //       fetchMessages(conversation._id);
  //     }
  //   }
  // }, [selectedContact, conversations]);

  const messagesLengthRef = useRef(messages.length);
  const currentConversationRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    const prevLength = messagesLengthRef.current;
    const currentConv = useChatStore.getState().currentConversation;
    const prevConv = currentConversationRef.current;

    // Scroll only if loading a new conversation or a new message is appended (sent/received)
    if (currentConv !== prevConv || messages.length > prevLength) {
      scrollToBottom();
    }

    // Keep refs up-to-date
    messagesLengthRef.current = messages.length;
    currentConversationRef.current = currentConv;
  }, [messages]);

  // Mark messages as read when viewing the chat
  useEffect(() => {
    const checkAndMarkRead = () => {
      if (selectedContact && messages.length > 0) {
        const hasUnread = messages.some(
          (msg) => msg.messageStatus !== "read" && String(msg.receiver?._id || msg.receiver) === String(user?._id)
        );
        if (hasUnread && document.visibilityState !== "hidden") {
          markMessagesAsRead(selectedContact._id);
        }
      }
    };

    checkAndMarkRead();

    window.addEventListener("focus", checkAndMarkRead);
    document.addEventListener("visibilitychange", checkAndMarkRead);
    return () => {
      window.removeEventListener("focus", checkAndMarkRead);
      document.removeEventListener("visibilitychange", checkAndMarkRead);
    };
  }, [selectedContact, messages, user, markMessagesAsRead]);

  useEffect(() => {
    if (message && selectedContact) {
      startTyping(selectedContact._id);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(selectedContact._id);
      }, 2000);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, selectedContact, startTyping, stopTyping]);

  useOutsideClick(emojiPickerRef, () => {
    if (showEmojiPicker) setShowEmojiPicker(false);
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setShowFileMenu(false);
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        setFilePreview(URL.createObjectURL(file));
      }
      
    }
  };

  const handleSendMessage = async () => {
    if (!selectedContact) return;
    setFilePreview(null);
    try {
      const formData = new FormData();

      formData.append("senderId", user._id);
      formData.append("receiverId", selectedContact._id);

      const status = online ? "delivered" : "send";
      formData.append("messageStatus", status);

      if (message.trim()) {
        formData.append("content", message.trim());
      }
      console.log('this is selected file',selectedFile)
      // If there's a file, include that too
      if (selectedFile) {
        formData.append("media", selectedFile, selectedFile.name);
      }
      // If neither, do nothing
      if (!message.trim() && !selectedFile) return;

      await sendMessage(formData);

      // Clear inputs after sending
      setMessage("");
      setSelectedFile(null);
      setFilePreview(null);
      setShowFileMenu(false);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        // Automatically send the voice message
        try {
          const formData = new FormData();
          formData.append("senderId", user._id);
          formData.append("receiverId", selectedContact._id);
          
          const onlineStatus = isUserOnline(selectedContact?._id);
          formData.append("messageStatus", onlineStatus ? "delivered" : "send");
          formData.append("media", audioFile);

          await sendMessage(formData);
        } catch (err) {
          console.error("Failed to send recorded audio:", err);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to access microphone:", err);
      alert("Please grant microphone permission to record voice messages.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    clearInterval(recordingTimerRef.current);
    audioChunksRef.current = [];
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const handleVideoCall = () => {
    if (selectedContact && online) {
      // Get the initiateCall function from the store
      const { initiateCall } = useVideoCallStore.getState();
      console.log('this is initial call',initiateCall)

      console.log("Starting video call with selectedContact:", {
        id: selectedContact._id,
        name: selectedContact.username,
        avatar: selectedContact.profilePicture, // This should be the URL, not "video"
        fullContact: selectedContact,
      });

      // Make sure we're passing the correct profile picture URL
      const avatarUrl =
        selectedContact.profilePicture ||
        "/placeholder.svg?height=128&width=128";

      initiateCall(
        selectedContact._id,
        selectedContact.username,
        avatarUrl, // Pass the actual URL, not "video"
        "video"
      );
    } else {
      alert("User is offline. Cannot initiate video call.");
    }
  };

  const renderDateSeparator = (date) => {
    if (!isValidDate(date)) {
      console.error("Invalid date:", date);
      return null;
    }

    let dateString;
    if (isToday(date)) {
      dateString = "Today";
    } else if (isYesterday(date)) {
      dateString = "Yesterday";
    } else {
      dateString = format(date, "EEEE, MMMM d");
    }

    return (
      <div className="flex justify-center my-4">
        <span
          className={`px-4 py-2 rounded-full text-sm ${
            theme === "dark"
              ? "bg-gray-700 text-gray-300"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {dateString}
        </span>
      </div>
    );
  };

  // Group messages by date
  const groupedMessages = Array.isArray(messages)
    ? messages.reduce((acc, message) => {
        if (!message.createdAt) return acc;

        const date = new Date(message.createdAt);
        if (isValidDate(date)) {
          const dateString = format(date, "yyyy-MM-dd");
          if (!acc[dateString]) {
            acc[dateString] = [];
          }
          acc[dateString].push(message);
        } else {
          console.error("Invalid date for message:", message);
        }
        return acc;
      }, {})
    : {};

  const handleReaction = (messageId, emoji) => {
    addReaction(messageId, emoji);
  };
  if (!selectedContact) {
    return (
      <div className="flex-1  flex flex-col items-center justify-center mx-auto h-screen text-center">
        <div className="max-w-md">
          <img
            src={whatsappImage}
            alt="Chat Application"
            className="w-full h-auto"
          />
          <h2
            className={`text-3xl font-semibold mb-4 ${
              theme === "dark" ? "text-white" : "text-black"
            }`}
          >
            Select a conversation to start chatting
          </h2>
          <p
            className={`${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            } mb-6`}
          >
            Choose a contact from the list on the left to begin messaging.
          </p>
          <p
            className={`${
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            } text-sm mt-8 flex items-center justify-center gap-2`}
          >
            <FaLock className="h-4 w-4" />
            Your personal messages are end-to-end encrypted
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 h-screen w-full flex flex-col">
        <div
          className={`p-4 ${
            theme === "dark"
              ? "bg-[#303430] text-white"
              : "bg-[rgb(239,242,245)] text-gray-600"
          } flex items-center`}
        >
          <button
            className="mr-2 focus:outline-none"
            onClick={() => setSelectedContact(null)}
          >
            <FaArrowLeft className="h-6 w-6" />
          </button>
          <img
            src={
              selectedContact?.profilePicture ||
              "/placeholder.svg?height=40&width=40"
            }
            alt={selectedContact?.username}
            className="w-10 h-10 rounded-full"
          />
          <div className="ml-3 flex-grow">
            <h2 className="font-semibold text-start">
              {selectedContact?.username}
            </h2>

            {isTyping ? (
              <div className="text-green-500 text-sm font-medium animate-pulse drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]">
                Typing...
              </div>
            ) : (
              <p
                className={`text-sm ${
                  online
                    ? "text-green-500 font-medium drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]"
                    : theme === "dark"
                    ? "text-gray-400"
                    : "text-gray-500"
                }`}
              >
                {online
                  ? "Online"
                  : lastSeen
                  ? `Last seen ${format(new Date(lastSeen), "HH:mm")}`
                  : "Offline"}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <button
              className="focus:outline-none"
              onClick={handleVideoCall}
              title={online ? "Start video call" : "User is offline"}
            >
              <FaVideo
                className={`h-5 w-5 text-green-500 hover:text-green-600`}
              />
            </button>
            <button className="focus:outline-none">
              <FaEllipsisV className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div
          className={`flex-1 p-4 overflow-y-auto ${
            theme === "dark" ? "bg-[#191a1a]" : "bg-[rgb(241,236,229)]"
          }`}
        >
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <React.Fragment key={date}>
              {renderDateSeparator(new Date(date))}
              {msgs.map((msg) => (
                  <MessageBubble
                    key={msg._id || msg.tempId}
                    message={msg}
                    theme={theme}
                    currentUser={user}
                    onReact={handleReaction}
                    deleteMessage={deleteMessage}
                  />
                ))}
            </React.Fragment>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {filePreview && (
          <div className="relative p-2">
            {selectedFile?.type.startsWith("video/") ? (
              <video
                src={filePreview}
                controls
                className="w-80 object-cover rounded shadow-lg mx-auto"
              />
            ) : (
              <img
                src={filePreview}
                alt="File preview"
                className="w-80 object-cover rounded shadow-lg mx-auto"
              />
            )}

            <button
              onClick={() => {
                setSelectedFile(null);
                setFilePreview(null);
              }}
              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          className={`p-4 ${
            theme === "dark" ? "bg-[#303430]" : "bg-white"
          } flex items-center space-x-2`}
        >
          {isRecording ? (
            <div className="flex-grow flex items-center justify-between px-4 py-2 bg-red-50/10 dark:bg-red-900/10 rounded-full border border-red-500/20 text-red-500 animate-pulse">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                <span className="font-medium text-sm">Recording Voice...</span>
                <span className="text-xs opacity-80 font-mono">{formatDuration(recordingSeconds)}</span>
              </div>
              <div className="flex items-center space-x-3">
                {/* Cancel Button */}
                <button
                  onClick={cancelRecording}
                  className="p-1.5 hover:bg-red-500/20 rounded-full transition-colors focus:outline-none"
                  title="Discard recording"
                >
                  <FaTrash className="h-4 w-4 text-red-500" />
                </button>
                {/* Stop & Send Button */}
                <button
                  onClick={stopRecording}
                  className="p-1.5 hover:bg-green-500/20 rounded-full transition-colors focus:outline-none"
                  title="Send recording"
                >
                  <FaCheck className="h-4 w-4 text-green-500" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                className="focus:outline-none"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <FaSmile
                  className={`h-6 w-6 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                />
              </button>
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute left-0 bottom-16 z-50"
                >
                  <EmojiPicker
                    onEmojiClick={(emojiObject) => {
                      setMessage((prev) => prev + emojiObject.emoji);
                      setShowEmojiPicker(false);
                    }}
                    theme={theme}
                  />
                </div>
              )}
              <div className="relative">
                <button
                  className="focus:outline-none"
                  onClick={() => setShowFileMenu(!showFileMenu)}
                >
                  <FaPaperclip
                    className={`h-6 w-6 ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    }`}
                  />
                </button>

                {showFileMenu && (
                  <div
                    className={`absolute bottom-full left-0 mb-2 ${
                      theme === "dark" ? "bg-gray-700" : "bg-white"
                    } rounded-lg shadow-lg`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,video/*,audio/*,application/*"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`
        flex items-center px-4 py-2 w-full transition-colors
        hover:bg-gray-100
        ${theme === "dark" ? "hover:bg-gray-500" : "hover:bg-gray-100"}
      `}
                    >
                      <FaImage className="mr-2" /> Image/Video
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`
        flex items-center px-4 py-2 w-full transition-colors
        hover:bg-gray-100
        ${theme === "dark" ? "hover:bg-gray-500" : "hover:bg-gray-100"}
      `}
                    >
                      <FaFile className="mr-2" /> Document
                    </button>
                  </div>
                )}
              </div>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message"
                className={`flex-grow px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  theme === "dark"
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-white text-black border-gray-300"
                }`}
              />
              <button
                className="focus:outline-none"
                onClick={message.trim() || selectedFile ? handleSendMessage : startRecording}
              >
                {message.trim() || selectedFile ? (
                  <FaPaperPlane className="h-6 w-6 text-green-500 hover:scale-105 transition-transform" />
                ) : (
                  <FaMicrophone className="h-6 w-6 text-green-500 hover:scale-105 transition-transform" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <VideoCallManager socket={socket} />
    </>
  );
}
