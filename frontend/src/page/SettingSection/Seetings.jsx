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
  FaCog,
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
  const [activeDetail, setActiveDetail] = useState(null);
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
                  { icon: FaQuestionCircle, label: "Help", action: () => setActiveDetail("help") },
                ].map((item) => {
                  const content = (
                    <>
                      <item.icon className="h-5 w-5" />
                      <div
                        className={`border-b ${
                          theme === "dark" ? "border-gray-700" : "border-gray-200"
                        }  w-full p-4`}
                      >
                        {item.label}
                      </div>
                    </>
                  );
                  if (item.href) {
                    return (
                      <Link
                        to={item.href}
                        key={item.label}
                        className={`w-full flex items-center gap-3 p-2 rounded ${
                          theme === "dark"
                            ? "text-white hover:bg-[#202c33]"
                            : "text-black hover:bg-gray-100"
                        }`}
                      >
                        {content}
                      </Link>
                    );
                  } else {
                    return (
                      <button
                        onClick={item.action}
                        key={item.label}
                        className={`w-full flex items-center gap-3 p-2 rounded text-start ${
                          theme === "dark"
                            ? "text-white hover:bg-[#202c33]"
                            : "text-black hover:bg-gray-100"
                        }`}
                      >
                        {content}
                      </button>
                    );
                  }
                })}

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

        {/* Right Details Panel */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          {activeDetail === "help" ? (
            <div
              className={`w-full max-w-xl p-8 rounded-2xl shadow-xl border transition-all duration-300 ${
                theme === "dark"
                  ? "bg-[#1f2c34] border-[#2f3b43] text-white"
                  : "bg-gray-50 border-gray-200 text-black"
              }`}
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-600/20">
                <FaQuestionCircle className="h-8 w-8 text-green-500" />
                <div>
                  <h2 className="text-2xl font-bold">Help & Support</h2>
                  <p className="text-xs text-gray-400">Get assistance and contact our team</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Admin Enquiry Box */}
                <div
                  className={`p-5 rounded-xl border ${
                    theme === "dark"
                      ? "bg-[#111b21] border-[#2f3b43]"
                      : "bg-white border-gray-200 shadow-sm"
                  }`}
                >
                  <h3 className="font-semibold text-green-500 mb-2 text-base">Contact Support & Enquiry</h3>
                  <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                    If you have any questions, encounter technical issues, or want to make an enquiry, please contact our administrator directly:
                  </p>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-green-500 font-semibold">Admin Phone Number</p>
                      <p className="text-lg font-bold tracking-wide">+91 78923 92608</p>
                    </div>
                    <button
                      onClick={() => window.open("https://wa.me/917892392608", "_blank")}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-green-500/20"
                    >
                      Chat on WhatsApp
                    </button>
                  </div>
                </div>

                {/* FAQ / Info Accordion items */}
                <div className="space-y-3">
                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'border-[#2f3b43] bg-[#222e35]/50' : 'border-gray-200 bg-white'}`}>
                    <h4 className="font-semibold text-sm">Help Center</h4>
                    <p className="text-xs text-gray-400 mt-1">Read our guides and FAQs to quickly learn how to use Talkies features.</p>
                  </div>

                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'border-[#2f3b43] bg-[#222e35]/50' : 'border-gray-200 bg-white'}`}>
                    <h4 className="font-semibold text-sm">Terms and Privacy Policy</h4>
                    <p className="text-xs text-gray-400 mt-1">Learn about your rights and how we handle and protect your data.</p>
                  </div>

                  <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'border-[#2f3b43] bg-[#222e35]/50' : 'border-gray-200 bg-white'}`}>
                    <h4 className="font-semibold text-sm">App Info</h4>
                    <p className="text-xs text-gray-400 mt-1">Talkies Web v2.1.0 • Built with MERN, WebRTC, TailwindCSS, & Socket.io</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 max-w-sm">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <FaCog className="h-10 w-10 text-green-500 animate-spin" style={{ animationDuration: "12s" }} />
              </div>
              <h3 className="text-xl font-bold mb-2">Talkies Settings</h3>
              <p className="text-sm text-gray-400">
                Select an option from the sidebar settings menu to view details and customize your experience.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
