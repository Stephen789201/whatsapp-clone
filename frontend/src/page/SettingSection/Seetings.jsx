import React, { useState } from "react";
import {
  FaSearch,
  FaUser,
  FaQuestionCircle,
  FaMoon,
  FaSun,
  FaSignOutAlt,
  FaComment,
  FaPalette,
} from "react-icons/fa";
import useThemeStore from "../../store/themeStore";
import useSettingsStore from "../../store/settingsStore";
import Layout from "../../components/Layout";
import { Link, useNavigate } from "react-router-dom";
import userStore from "../../store/useUserStore";
import useStore from "../../store/layoutStore";
import { useChatStore } from "../../store/chatStore";
import { logoutUser } from "../../services/user.service";
import { toast } from "react-toastify";

export default function Setting() {
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  const [isWallpaperDialogOpen, setIsWallpaperDialogOpen] = useState(false);
  const { theme } = useThemeStore();
  const { user, clearUser } = userStore();
  const { setChatWallpaper, resetWallpaper } = useSettingsStore();
  const { clearLayout } = useStore();
  const { resetChatStore } = useChatStore();
  const navigate = useNavigate();

  const toggleThemeDialog = () => {
    setIsThemeDialogOpen(!isThemeDialogOpen);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      clearUser();
      clearLayout();
      resetChatStore();
      toast.success("Logged out successfully");
      navigate("/user-login");
    } catch (error) {
      console.error(error, "failed to log out");
      toast.error("Logout failed");
    }
  };

  return (
    <Layout
      isThemeDialogOpen={isThemeDialogOpen}
      toggleThemeDialog={toggleThemeDialog}
    >
      <div
        className={`flex h-screen ${
          theme === "dark"
            ? "bg-[rgb(17,27,33)] text-white"
            : "bg-white text-black"
        }`}
      >
        <div
          className={`w-[400px] border-r flex flex-col h-screen ${
            theme === "dark" ? "border-gray-600" : "border-gray-200"
          }`}
        >
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
            <h1 className="text-xl font-semibold mb-4">Settings</h1>

            {/* Search Bar */}
            <div className="relative mb-4">
              <FaSearch className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                placeholder="Search settings"
                className={`w-full ${
                  theme === "dark"
                    ? "bg-[#202c33] text-white"
                    : "bg-gray-100 text-black"
                } border-none pl-10 placeholder-gray-400 rounded p-2`}
                
              />
            </div>

            {/* Profile Section */}
            <div
              className={`flex items-center gap-4 p-3 ${
                theme === "dark" ? "hover:bg-[#202c33]" : "hover:bg-gray-100"
              } rounded-lg cursor-pointer mb-4`}
            >
              <img
                src={user?.profilePicture}
                alt="Profile"
                className="w-14 h-14 rounded-full"
              />
              <div>
                <h2 className="font-semibold">{user?.username}</h2>
                <p className="text-sm text-gray-400">{user?.about}</p>
              </div>
            </div>

            {/* Menu Items */}
            <div className="">
              <div className="space-y-1">
                {[
                  { icon: FaUser, label: "Account", href: "/user-details" },
                  { icon: FaComment, label: "Chats", href: "/" },
                  { icon: FaQuestionCircle, label: "Help" },
                ].map((item) => (
                  <Link
                    to={item.href}
                    key={item.label}
                    className={`w-full flex items-center gap-3 p-2 rounded ${
                      theme === "dark"
                        ? "text-white hover:bg-[#202c33]"
                        : "text-black hover:bg-gray-100"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <div
                      className={`border-b ${
                        theme === "dark" ? "border-gray-700" : "border-gray-200"
                      }  w-full p-4`}
                    >
                      {item.label}
                    </div>
                  </Link>
                ))}

                {/* Theme Button */}
                <button
                  onClick={toggleThemeDialog}
                  className={`w-full flex items-center  gap-3 p-2 rounded ${
                    theme === "dark"
                      ? "text-white hover:bg-[#202c33]"
                      : "text-black hover:bg-gray-100"
                  }`}
                >
                  {theme === "dark" ? (
                    <FaMoon className="h-5 w-5" />
                  ) : (
                    <FaSun className="h-5 w-5" />
                  )}
                  <div
                    className={`flex flex-col text-start border-b ${
                      theme === "dark" ? "border-gray-700" : "border-gray-200"
                    }  w-full p-2`}
                  >
                    Theme
                    <span className="ml-auto text-sm text-gray-400">
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </span>
                  </div>
                </button>

                {/* Wallpaper Button */}
                <button
                  onClick={() => setIsWallpaperDialogOpen(true)}
                  className={`w-full flex items-center gap-3 p-2 rounded ${
                    theme === "dark"
                      ? "text-white hover:bg-[#202c33]"
                      : "text-black hover:bg-gray-100"
                  }`}
                >
                  <FaPalette className="h-5 w-5 text-green-500" />
                  <div
                    className={`flex flex-col text-start border-b ${
                      theme === "dark" ? "border-gray-700" : "border-gray-200"
                    }  w-full p-2`}
                  >
                    Chat Wallpaper
                    <span className="ml-auto text-sm text-gray-400">
                      Customize background
                    </span>
                  </div>
                </button>
              </div>

              {/* Wallpaper Dialog */}
              {isWallpaperDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                  <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-[#202c33] text-white' : 'bg-white text-black'}`}>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold">Choose Wallpaper</h2>
                      <button onClick={() => setIsWallpaperDialogOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                    </div>

                    <div className="space-y-6">
                      {/* Solid Colors */}
                      <div>
                        <p className="text-sm font-semibold mb-3 opacity-70">Solid Colors</p>
                        <div className="flex flex-wrap gap-3">
                          {[
                            { val: "#f1ece5", dark: "#111b21", name: "Default" },
                            { val: "#E6E6FA", dark: "#1a1a2e", name: "Lavender" },
                            { val: "#F0FFF0", dark: "#0d1a0d", name: "Honeydew" },
                            { val: "#FFF5EE", dark: "#1a0f0d", name: "Shell" },
                            { val: "#F0F8FF", dark: "#0d1117", name: "Alice" }
                          ].map((color) => (
                            <button
                              key={color.name}
                              onClick={() => {
                                setChatWallpaper({ type: "color", value: color.val, darkValue: color.dark });
                                toast.success(`${color.name} wallpaper set`);
                              }}
                              className="w-10 h-10 rounded-full border-2 border-white/20 shadow-inner hover:scale-110 transition-transform"
                              style={{ backgroundColor: theme === 'dark' ? color.dark : color.val }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Custom Upload */}
                      <div>
                        <p className="text-sm font-semibold mb-3 opacity-70">Custom Image</p>
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="wallpaper-upload" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setChatWallpaper({ type: "image", value: reader.result, darkValue: reader.result });
                                toast.success("Custom image set as wallpaper");
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label 
                          htmlFor="wallpaper-upload"
                          className="w-full flex items-center justify-center p-3 rounded-xl border-2 border-dashed border-gray-500 hover:border-green-500 hover:bg-green-500/10 cursor-pointer transition-all"
                        >
                          <span className="text-sm">Click to upload image</span>
                        </label>
                      </div>

                      <button 
                        onClick={() => {
                          resetWallpaper();
                          toast.info("Wallpaper reset to default");
                        }}
                        className="w-full p-3 rounded-xl bg-gray-500/20 hover:bg-gray-500/30 text-sm font-semibold transition-colors"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className={` w-full flex items-center gap-3 p-4 rounded text-red-500 font-medium ${
                  theme === "dark" ? "hover:bg-[#202c33]" : "hover:bg-gray-100"
                } mt-4 transition-colors`}
              >
                <FaSignOutAlt className="h-5 w-5" />
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
