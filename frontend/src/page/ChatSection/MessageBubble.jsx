import React, { useState, useRef } from "react";
import { FaPlus, FaSmile} from "react-icons/fa";
import { format } from "date-fns";
import EmojiPicker from "emoji-picker-react";
import useOutsideClick from "../../hooks/useOutsideClick";
import { FaCheck, FaCheckDouble, FaFilePdf, FaDownload, FaReply } from "react-icons/fa";
import { RxCross2 } from "react-icons/rx";
import { HiDotsVertical } from "react-icons/hi";
import { FaTrashAlt, FaRegCopy } from "react-icons/fa";
import VoiceMessage from "./VoiceMessage";


const MessageBubble = ({ message, theme, onReact, currentUser, deleteMessage, onReply }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const messageRef = useRef(null);
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef(null);

  const emojiPickerRef = useRef(null);
  const reactionsMenuRef = useRef(null);

  const senderId = typeof message.sender === "object" ? message.sender?._id : message.sender;
  const isUserMessage = String(senderId) === String(currentUser?._id);

  const bubbleClass = isUserMessage ? `chat-end` : `chat-start`;

  const bubbleContentClass = isUserMessage
    ? `chat-bubble  md:max-w-[50%] min-w-[130px]  ${
        theme === "dark" ? "bg-[#144d38] text-white" : "bg-[#d9fdd3] text-black"
      }`
    : `chat-bubble  md:max-w-[50%] min-w-[130px]   ${
        theme === "dark" ? "bg-[#144d38] text-white" : "bg-white text-black"
      }`;

  const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const handleReact = (emoji) => {
    onReact(message._id, emoji);
    setShowEmojiPicker(false);
    setShowReactions(false);
  };

  useOutsideClick(emojiPickerRef, () => {
    if (showEmojiPicker) setShowEmojiPicker(false);
  });
  useOutsideClick(reactionsMenuRef, () => {
    if (showReactions) setShowReactions(false);
  });

  useOutsideClick(optionsRef, () => {
  if (showOptions) setShowOptions(false);
});

  if (message === 0) return;

  return (
    <div className={`chat ${bubbleClass}`}>
      <div
        className={`${bubbleContentClass} relative group `}
        ref={messageRef}
      >
        {message.parentMessage && (
          <div className={`mb-1.5 p-2 rounded text-xs border-l-4 text-start ${
            theme === "dark" 
              ? "bg-black/20 border-green-500 text-gray-300" 
              : "bg-black/5 border-green-500 text-gray-600"
          }`}>
            <span className="font-bold block text-green-500 mb-0.5">
              {message.parentMessage.sender?._id === currentUser._id || message.parentMessage.sender === currentUser._id
                ? "You" 
                : message.parentMessage.sender?.username || "Contact"}
            </span>
            <p className="truncate max-w-[220px]">
              {message.parentMessage.isDeleted ? "🚫 This message was deleted" : message.parentMessage.content}
            </p>
          </div>
        )}
        <div className="flex justify-start gap-2">
          {message.contentType === "text" && (
            <p className={`mr-2 ${message.isDeleted ? "italic opacity-60 text-sm" : ""}`}>
              {message.isDeleted 
                ? (isUserMessage ? "🚫 You deleted this message" : "🚫 This message was deleted")
                : message.content
              }
            </p>
          )}
          {message.contentType === "image" && (
            <div>
              <img
                src={message.imageOrVideoUrl}
                alt="Shared content"
                className="rounded-lg max-w-xs"
              />
              <p className="mt-1">{message.content}</p>
            </div>
          )}

{message.contentType === "video" && (
           <div>
             <video
               controls
               className="rounded-lg max-w-xs"
               src={message.imageOrVideoUrl}
             />
             <p className="mt-1">{message.content}</p>
           </div>
         )}

          {message.contentType === "audio" && (
            <VoiceMessage
              audioUrl={message.audioUrl}
              theme={theme}
              isUserMessage={isUserMessage}
            />
          )}

          {message.contentType === "document" && (
            <a
              href={message.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center space-x-3 p-3 rounded-lg border hover:bg-black/10 transition-colors ${
                theme === "dark" 
                  ? "bg-[#1f2c34]/50 border-white/10 text-white" 
                  : "bg-white/60 border-black/10 text-black"
              }`}
            >
              <div className="p-2 rounded bg-red-500 text-white">
                <FaFilePdf size={24} />
              </div>
              <div className="flex-1 min-w-0 max-w-[180px]">
                <p className="text-sm font-medium truncate block">
                  {message.content || "Document"}
                </p>
                <span className="text-[10px] opacity-60">PDF / Document</span>
              </div>
              <div className="text-green-500 hover:text-green-600 p-1">
                <FaDownload size={16} />
              </div>
            </a>
          )}

        </div>
                  <div className="self-end flex items-center justify-end gap-1 text-xs opacity-60 mt-2 ml-2">
            <span>{format(new Date(message.createdAt), "HH:mm")}</span>
            {isUserMessage && !message.isDeleted && (
              <>
                {message.messageStatus === "send" && <FaCheck size={12} />}
                {message.messageStatus === "delivered" && (
                  <FaCheckDouble size={12} />
                )}
                {message.messageStatus === "read" && (
                  <FaCheckDouble size={12} className="drop-shadow-sm" style={{ color: "#34b7f1" }} />
                )}
              </>
            )}
          </div>

          {/* 3-dot options menu icon - shows on hover */}
          {!message.isDeleted && (
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 ">
              <button
                onClick={() => setShowOptions((prev) => !prev)}
                className={`p-1 rounded-full ${
                  theme === "dark"
                    ? " text-white"
                    : " text-gray-800"
                }`}
              >
                <HiDotsVertical size={18} />
              </button>
            </div>
          )}

          {!message.isDeleted && (
            <div
              className={`absolute ${
                isUserMessage ? "-left-10" : "-right-10"
              } top-1/2 transform -translate-y-1/2 
                        opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2`}
            >
              <button
                onClick={() => setShowReactions(!showReactions)}
                className={`p-2 rounded-full ${
                  theme === "dark"
                    ? "bg-[#202c33] hover:bg-[#202c33]/80"
                    : "bg-white hover:bg-gray-100"
                } shadow-lg`}
              >
                <FaSmile
                  className={theme === "dark" ? "text-gray-300" : "text-gray-600"}
                />
              </button>
            </div>
          )}

        {showReactions && (
          <div
            ref={reactionsMenuRef}
            className={`absolute -top-14 ${
              isUserMessage ? "right-0" : "left-0"
            } flex items-center rounded-full px-2.5 py-1.5 gap-1.5 shadow-2xl z-50 border transition-all duration-200 scale-100 origin-bottom ${
              theme === "dark"
                ? "bg-[#233138] border-[#2f3b43] text-white"
                : "bg-white border-gray-200 text-black"
            }`}
          >
            {quickReactions.map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleReact(emoji)}
                className="hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
            <div className="w-[1px] h-5 bg-gray-600 mx-1" />
            <button
              onClick={() => setShowEmojiPicker(true)}
              className="hover:bg-[#ffffff1a] rounded-full p-1"
            >
              <FaPlus className="h-4 w-4 text-gray-300" />
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute left-0 mb-6 z-50">
            <div className="relative">
              <EmojiPicker
                onEmojiClick={(emojiObject) => handleReact(emojiObject.emoji)}
                theme={theme}
              />
              <button
                onClick={() => setShowEmojiPicker(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              >
                <RxCross2 />
              </button>
            </div>
          </div>
        )}

        {message.reactions && message.reactions.length > 0 && (
          <div
            className={`absolute -bottom-2.5 ${
              isUserMessage ? "left-4" : "right-4"
            } flex items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 shadow-md border text-xs z-10 transition-all ${
              theme === "dark" 
                ? "bg-[#202c33] border-[#111b21] text-white" 
                : "bg-white border-gray-200 text-gray-800"
            }`}
          >
            {message.reactions.map((reaction, index) => (
              <span key={index} className="flex items-center justify-center">
                {reaction.emoji}
              </span>
            ))}
            {message.reactions.length > 1 && (
              <span className="text-[10px] ml-0.5 opacity-80">
                {message.reactions.length}
              </span>
            )}
          </div>
        )}


{showOptions && (
  <div
    ref={optionsRef}
    className={`absolute top-8 right-1 z-50 w-36 rounded-xl shadow-lg py-2 text-sm 
      ${theme === "dark" ? "bg-[#1d1f1f] text-white" : "bg-gray-100 text-black"} 
      b`}
  >
    {/* Reply Button */}
    <button
      onClick={() => {
        onReply(message);
        setShowOptions(false);
      }}
      className="flex items-center w-full px-4 py-2 gap-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
    >
      <FaReply size={14} />
      <span>Reply</span>
    </button>

    {/* Copy Button */}
    <button
      onClick={() => {
        if (message.contentType === "text") {
          navigator.clipboard.writeText(message.content);
        }
        setShowOptions(false);
      }}
      className="flex items-center w-full px-4 py-2 gap-3 rounded-lg 
        "
    >
      <FaRegCopy  size={14} />
      <span>Copy</span>
    </button>

    {/* Delete for Me Button */}
    <button
      onClick={() => {
        deleteMessage(message._id, 'me');
        setShowOptions(false);
      }}
      className="flex items-center w-full px-4 py-2 gap-3 rounded-lg text-red-600 hover:bg-black/5 dark:hover:bg-white/5"
    >
      <FaTrashAlt className="text-red-500" size={14} />
      <span>Delete for me</span>
    </button>

    {/* Delete for Everyone Button */}
    {isUserMessage && (
      <button
        onClick={() => {
          deleteMessage(message._id, 'everyone');
          setShowOptions(false);
        }}
        className="flex items-center w-full px-4 py-2 gap-3 rounded-lg text-red-600 hover:bg-black/5 dark:hover:bg-white/5"
      >
        <FaTrashAlt className="text-red-500" size={14} />
        <span>Delete for everyone</span>
      </button>
    )}
  </div>
)}
      </div>
    </div>
  );
};

export default MessageBubble;
