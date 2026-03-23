import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  MdAttachFile,
  MdCircle,
  MdClose,
  MdErrorOutline,
  MdRefresh,
  MdSearch,
  MdSend,
} from "react-icons/md";
import { toast } from "react-toastify";
import { db, storage } from "../../firebaseConfig";
import { useAuth } from "../../auth/AuthProvider";

const statusClass = {
  online: "is-online",
  away: "is-away",
  offline: "is-offline",
};

export default function ChatPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [activeSupportFlow, setActiveSupportFlow] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const messageListRef = useRef(null);
  const mediaInputRef = useRef(null);
  const hasLoadedThreadsRef = useRef(false);
  const previousUnreadByThreadRef = useRef(new Map());
  const loadedMessageSnapshotByChatRef = useRef(new Set());
  const notifiedMessageIdsRef = useRef(new Set());

  const notifyIncomingMessage = ({ customerName, text, messageId }) => {
    if (messageId) {
      if (notifiedMessageIdsRef.current.has(messageId)) return;
      notifiedMessageIdsRef.current.add(messageId);
    }

    const preview = String(text || "New message").trim() || "New message";
    const title = String(customerName || "Customer").trim() || "Customer";

    toast.info(`New message from ${title}: ${preview}`, {
      autoClose: 5000,
      position: "top-right",
    });

    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification(`New message from ${title}`, {
        body: preview,
        tag: `chat-${title}`,
      });
    } catch {
      // Browser notification is best effort.
    }
  };

  const toMillis = (value) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const formatTime = (value) => {
    const ms = toMillis(value);
    if (!ms) return "";
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatThreadTime = (value) => {
    const ms = toMillis(value);
    if (!ms) return "";
    const date = new Date(ms);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { day: "2-digit", month: "short" });
  };

  const avatarFrom = (name, email) => {
    const source = String(name || email || "User").trim();
    const chunks = source.split(/\s+/).filter(Boolean);
    if (chunks.length >= 2) {
      return `${chunks[0][0] || ""}${chunks[1][0] || ""}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  };

  const resolveMessageTime = (data = {}) => {
    return data.serverTimestamp || data.timestamp || data.createdAt || null;
  };

  const resolveMediaType = (data = {}) => {
    const explicit = String(data.mediaType || "").toLowerCase();
    if (explicit === "image" || explicit === "video") return explicit;

    const mimeType = String(data.mimeType || "").toLowerCase();
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";

    const mediaUrl = String(data.mediaUrl || data.image || data.video || "").toLowerCase();
    if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|#|$)/.test(mediaUrl)) return "image";
    if (/\.(mp4|mov|m4v|webm|ogv|m3u8)(\?|#|$)/.test(mediaUrl)) return "video";
    return "";
  };

  const clearSelectedMedia = () => {
    setSelectedMedia(null);
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
    }
    setMediaPreviewUrl("");
    setUploadProgress(0);
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // Permission prompt may be blocked by browser; keep toast fallback.
      });
    }
  }, []);

  useEffect(() => {
    setLoadingThreads(true);
    const chatsQuery = query(
      collection(db, "chats"),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(
      chatsQuery,
      (snap) => {
        const nextThreads = snap.docs.map((d) => {
          const data = d.data() || {};
          const userName = String(data.userName || data.customerName || "Customer").trim();
          const userEmail = String(data.userEmail || "").trim();
          const status = toMillis(data.lastTimestamp) > 0 ? "online" : "offline";

          return {
            id: d.id,
            chatId: d.id,
            customer: userName || "Customer",
            email: userEmail,
            avatar: avatarFrom(userName, userEmail),
            status,
            unread: Number(data.unreadForAdmin || 0),
            lastSeen: formatThreadTime(
              data.lastServerTimestamp || data.lastTimestamp || data.updatedAt
            ),
            latest: String(data.lastMessage || "No messages yet"),
            lastMessageBy: String(data.lastMessageBy || "").trim(),
          };
        });

        if (hasLoadedThreadsRef.current) {
          nextThreads.forEach((thread) => {
            const previousUnread = Number(previousUnreadByThreadRef.current.get(thread.id) || 0);
            const nextUnread = Number(thread.unread || 0);
            const fromCustomer = thread.lastMessageBy && thread.lastMessageBy !== user?.uid;

            if (nextUnread > previousUnread && fromCustomer) {
              notifyIncomingMessage({
                customerName: thread.customer,
                text: thread.latest,
                messageId: `thread-${thread.id}-${nextUnread}`,
              });
            }
          });
        }

        previousUnreadByThreadRef.current = new Map(
          nextThreads.map((thread) => [thread.id, Number(thread.unread || 0)])
        );
        hasLoadedThreadsRef.current = true;

        setThreads(nextThreads);
        setLoadingThreads(false);
        setError("");

        setSelectedId((prev) => {
          if (prev && nextThreads.some((t) => t.id === prev)) return prev;
          return nextThreads[0]?.id || "";
        });
      },
      (err) => {
        setLoadingThreads(false);
        setError(err?.message || "Could not load chats.");
      }
    );

    return () => unsub();
  }, [user?.uid]);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const latest = String(thread.latest || "");
      return (
        thread.customer.toLowerCase().includes(q) ||
        thread.email.toLowerCase().includes(q) ||
        latest.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, threads]);

  const activeThread =
    threads.find((thread) => thread.id === selectedId) || filteredThreads[0] || null;

  useEffect(() => {
    if (!activeThread?.chatId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const messagesQuery = query(
      collection(db, "chats", activeThread.chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(
      messagesQuery,
      async (snap) => {
        const currentChatId = activeThread.chatId;
        const hasLoadedCurrentChat = loadedMessageSnapshotByChatRef.current.has(currentChatId);

        const nextMessages = snap.docs.map((d) => {
          const data = d.data() || {};
          const resolvedTime = resolveMessageTime(data);
          const senderRole = String(data.senderRole || "").toLowerCase();
          const senderId = String(data.senderId || "").trim();
          const from = senderRole === "admin" || senderId === user?.uid
            ? "admin"
            : senderRole === "bot"
              ? "bot"
              : "customer";

          return {
            id: d.id,
            from,
            senderRole,
            senderId,
            seen: data.seen === true,
            text: String(data.text || data.message || "").trim(),
            mediaUrl: String(data.mediaUrl || data.image || data.video || "").trim(),
            mediaType: resolveMediaType(data),
            fileName: String(data.fileName || "").trim(),
            options: Array.isArray(data.options)
              ? data.options.map((item) => String(item || "").trim()).filter(Boolean)
              : [],
            time: formatTime(resolvedTime),
            _sortMs: toMillis(resolvedTime),
            _raw: data,
          };
        }).sort((a, b) => {
          if (a._sortMs === b._sortMs) return a.id.localeCompare(b.id);
          return a._sortMs - b._sortMs;
        });

        if (hasLoadedCurrentChat) {
          snap.docChanges().forEach((change) => {
            if (change.type !== "added") return;
            const data = change.doc.data() || {};
            const senderRole = String(data.senderRole || "").toLowerCase();
            const senderId = String(data.senderId || "").trim();
            if (senderRole !== "user" || senderId === user?.uid) return;

            notifyIncomingMessage({
              customerName: activeThread.customer,
              text: String(data.text || data.message || "New message").trim(),
              messageId: change.doc.id,
            });
          });
        } else {
          loadedMessageSnapshotByChatRef.current.add(currentChatId);
        }

        setMessages(nextMessages);
        setLoadingMessages(false);

        const unseenCustomerDocs = snap.docs.filter((docSnap) => {
          const data = docSnap.data() || {};
          const senderRole = String(data.senderRole || "").toLowerCase();
          const senderId = String(data.senderId || "").trim();
          return senderRole === "user" && senderId !== user?.uid && data.seen !== true;
        });

        if (unseenCustomerDocs.length > 0) {
          try {
            const batch = writeBatch(db);
            unseenCustomerDocs.forEach((docSnap) => {
              batch.update(docSnap.ref, {
                seen: true,
                seenAt: serverTimestamp(),
              });
            });
            batch.update(doc(db, "chats", activeThread.chatId), {
              unreadForAdmin: 0,
              updatedAt: serverTimestamp(),
            });
            await batch.commit();
          } catch {
            // Non-blocking: unread badge will sync on next successful update.
          }
        }
      },
      (err) => {
        setLoadingMessages(false);
        setError(err?.message || "Could not load messages.");
      }
    );

    return () => unsub();
  }, [activeThread?.chatId, user?.uid]);

  useEffect(() => {
    if (!activeThread?.chatId) {
      setActiveSupportFlow(null);
      return;
    }

    const unsub = onSnapshot(doc(db, "chats", activeThread.chatId), (snap) => {
      const data = snap.data() || {};
      setActiveSupportFlow(data.supportFlow || null);
    });

    return () => unsub();
  }, [activeThread?.chatId]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages]);

  const refreshChats = () => {
    setError("");
    setLoadingThreads(true);
    setTimeout(() => setLoadingThreads(false), 250);
  };

  const sendMessage = async () => {
    const message = draft.trim();
    const hasMedia = Boolean(selectedMedia);
    if ((!message && !hasMedia) || !activeThread?.chatId || !user?.uid || sending) return;

    setSending(true);
    setError("");
    setUploadProgress(0);
    try {
      const localNow = new Date();
      let mediaUrl = "";
      let mediaType = "";
      let mimeType = "";
      let fileName = "";

      if (selectedMedia) {
        const file = selectedMedia;
        const isImage = String(file.type || "").startsWith("image/");
        const isVideo = String(file.type || "").startsWith("video/");

        if (!isImage && !isVideo) {
          throw new Error("Please select only image or video files.");
        }

        const maxBytes = 25 * 1024 * 1024;
        if (file.size > maxBytes) {
          throw new Error("Media size should be 25MB or less.");
        }

        mediaType = isImage ? "image" : "video";
        mimeType = String(file.type || "");
        fileName = String(file.name || "media");
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const mediaPath = `chats/${activeThread.chatId}/media/${user.uid}/${Date.now()}_${safeFileName}`;
        const storageRef = ref(storage, mediaPath);

        mediaUrl = await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file, {
            contentType: mimeType || undefined,
          });

          task.on(
            "state_changed",
            (snapshot) => {
              const progress =
                snapshot.totalBytes > 0
                  ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                  : 0;
              setUploadProgress(progress);
            },
            reject,
            () => getDownloadURL(task.snapshot.ref).then(resolve).catch(reject)
          );
        });
      }

      const messageText = message;
      const hasText = messageText.length > 0;
      const previewLabel = hasText
        ? messageText
        : mediaType === "image"
          ? "📷 Photo"
          : mediaType === "video"
            ? "🎬 Video"
            : "Media";

      await addDoc(collection(db, "chats", activeThread.chatId, "messages"), {
        chatId: activeThread.chatId,
        senderId: user.uid,
        senderRole: "admin",
        text: messageText,
        message: messageText,
        mediaUrl,
        mediaType,
        mimeType,
        fileName,
        seen: false,
        timestamp: localNow,
        serverTimestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "chats", activeThread.chatId), {
        lastMessage: previewLabel,
        lastMessageBy: user.uid,
        lastTimestamp: localNow,
        lastServerTimestamp: serverTimestamp(),
        unreadForUser: 1,
        updatedAt: serverTimestamp(),
      });

      setDraft("");
      clearSelectedMedia();
    } catch (err) {
      setError(err?.message || "Failed to send message.");
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const updateSupportFlowStep = async (step) => {
    if (!activeThread?.chatId) return;
    try {
      await updateDoc(doc(db, "chats", activeThread.chatId), {
        supportFlow: {
          step,
          selectedCategory: "",
          selectedQuantity: "",
          isCompleted: step === "HUMAN",
        },
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setError(err?.message || "Could not update support flow.");
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Customer Chat</h2>
          <div className="breadcrumb">Home / <span>Chat</span></div>
        </div>
        <button type="button" className="btn btn-outline" onClick={refreshChats}>
          <MdRefresh /> Refresh
        </button>
      </div>

      {error ? (
        <div className="card chat-error-banner">
          <MdErrorOutline />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="chat-layout">
        <aside className="card chat-thread-pane">
          <div className="chat-pane-head">
            <h3>Conversations</h3>
            <span>{filteredThreads.length} active</span>
          </div>

          <div className="search-wrap chat-search-wrap">
            <MdSearch />
            <input
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer or message"
            />
          </div>

          <div className="chat-thread-list">
            {loadingThreads ? (
              <div className="empty-state chat-empty">Loading conversations…</div>
            ) : filteredThreads.length === 0 ? (
              <div className="empty-state chat-empty">No conversations found.</div>
            ) : (
              filteredThreads.map((thread) => {
                const latest = thread.latest || "No messages yet";
                const isActive = activeThread?.id === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    className={`chat-thread-item${isActive ? " active" : ""}`}
                    onClick={() => {
                      setSelectedId(thread.id);
                    }}
                  >
                    <div className="chat-avatar">{thread.avatar}</div>
                    <div className="chat-thread-content">
                      <div className="chat-thread-top">
                        <strong>{thread.customer}</strong>
                        <span>{thread.lastSeen}</span>
                      </div>
                      <div className="chat-thread-bottom">
                        <p>{latest}</p>
                        {thread.unread > 0 ? (
                          <span className="chat-unread-pill">{thread.unread}</span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="card chat-main-pane">
          {activeThread ? (
            <>
              <div className="chat-main-head">
                <div className="chat-main-user">
                  <div className="chat-avatar large">{activeThread.avatar}</div>
                  <div>
                    <h3>{activeThread.customer}</h3>
                    <div className="chat-user-meta">
                      <MdCircle className={`chat-dot ${statusClass[activeThread.status]}`} />
                      {activeThread.status}
                      <span className="chat-user-sep">•</span>
                      {activeThread.email}
                    </div>
                  </div>
                </div>
                <div className="chat-head-actions">
                  {activeSupportFlow?.step ? (
                    <span className="chat-flow-pill">Flow: {activeSupportFlow.step}</span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => updateSupportFlowStep("HUMAN")}
                  >
                    Force Human
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => updateSupportFlowStep("START")}
                  >
                    Resume Bot
                  </button>
                  <span className="chat-thread-id">{activeThread.chatId}</span>
                </div>
              </div>

              <div className="chat-message-list" ref={messageListRef}>
                {loadingMessages ? (
                  <div className="empty-state">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">No messages yet. Start the conversation.</div>
                ) : messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-bubble-row ${message.from === "admin" ? "from-admin" : message.from === "bot" ? "from-bot" : "from-customer"}`}
                  >
                    <div className="chat-bubble">
                      {message.mediaUrl && message.mediaType === "image" ? (
                        <a
                          href={message.mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="chat-media-link"
                        >
                          <img
                            src={message.mediaUrl}
                            alt={message.fileName || "chat-media"}
                            className="chat-media-preview"
                          />
                        </a>
                      ) : null}

                      {message.mediaUrl && message.mediaType === "video" ? (
                        <video className="chat-media-preview" controls preload="metadata">
                          <source src={message.mediaUrl} type="video/mp4" />
                          Your browser does not support video playback.
                        </video>
                      ) : null}

                      {message.text ? <p>{message.text}</p> : null}
                      {message.options?.length ? (
                        <div className="chat-option-wrap">
                          {message.options.map((opt) => (
                            <button
                              key={`${message.id}-${opt}`}
                              type="button"
                              className="chat-option-chip"
                              disabled
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <span>{message.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedMedia ? (
                <div className="chat-media-draft">
                  <div className="chat-media-draft-preview">
                    {String(selectedMedia.type || "").startsWith("image/") ? (
                      <img src={mediaPreviewUrl} alt={selectedMedia.name || "selected-media"} />
                    ) : (
                      <video src={mediaPreviewUrl} controls preload="metadata" />
                    )}
                  </div>
                  <div className="chat-media-draft-meta">
                    <strong>{selectedMedia.name}</strong>
                    <span>{(selectedMedia.size / (1024 * 1024)).toFixed(2)} MB</span>
                    {sending && uploadProgress > 0 ? (
                      <span className="text-muted">Uploading: {uploadProgress}%</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={clearSelectedMedia}
                    disabled={sending}
                    aria-label="Remove selected media"
                  >
                    <MdClose />
                  </button>
                </div>
              ) : null}

              <div className="chat-compose-row">
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (!file) return;

                    const isImage = String(file.type || "").startsWith("image/");
                    const isVideo = String(file.type || "").startsWith("video/");
                    if (!isImage && !isVideo) {
                      setError("Please select only image or video files.");
                      if (mediaInputRef.current) mediaInputRef.current.value = "";
                      return;
                    }

                    setError("");
                    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
                    setSelectedMedia(file);
                    setMediaPreviewUrl(URL.createObjectURL(file));
                  }}
                  style={{ display: "none" }}
                />

                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Attach media"
                >
                  <MdAttachFile />
                </button>

                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                  placeholder="Write a message"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={sendMessage}
                  disabled={sending || (!draft.trim() && !selectedMedia)}
                >
                  <MdSend /> {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">Select a conversation to start chatting.</div>
          )}
        </section>
      </div>
    </>
  );
}
