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
import {
  MdCircle,
  MdErrorOutline,
  MdRefresh,
  MdSearch,
  MdSend,
} from "react-icons/md";
import { db } from "../../firebaseConfig";
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
  const messageListRef = useRef(null);

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
          };
        });

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
  }, []);

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
        const nextMessages = snap.docs.map((d) => {
          const data = d.data() || {};
          const resolvedTime = resolveMessageTime(data);
          const senderRole = String(data.senderRole || "").toLowerCase();
          const senderId = String(data.senderId || "").trim();
          const from = senderRole === "admin" || senderId === user?.uid ? "admin" : "customer";

          return {
            id: d.id,
            from,
            senderRole,
            senderId,
            seen: data.seen === true,
            text: String(data.text || data.message || "").trim(),
            time: formatTime(resolvedTime),
            _sortMs: toMillis(resolvedTime),
            _raw: data,
          };
        }).sort((a, b) => {
          if (a._sortMs === b._sortMs) return a.id.localeCompare(b.id);
          return a._sortMs - b._sortMs;
        });

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
    if (!message || !activeThread?.chatId || !user?.uid || sending) return;

    setSending(true);
    setError("");
    try {
      const localNow = new Date();
      await addDoc(collection(db, "chats", activeThread.chatId, "messages"), {
        chatId: activeThread.chatId,
        senderId: user.uid,
        senderRole: "admin",
        text: message,
        message,
        seen: false,
        timestamp: localNow,
        serverTimestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "chats", activeThread.chatId), {
        lastMessage: message,
        lastMessageBy: user.uid,
        lastTimestamp: localNow,
        lastServerTimestamp: serverTimestamp(),
        unreadForUser: 1,
        updatedAt: serverTimestamp(),
      });

      setDraft("");
    } catch (err) {
      setError(err?.message || "Failed to send message.");
    } finally {
      setSending(false);
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
                <span className="chat-thread-id">{activeThread.chatId}</span>
              </div>

              <div className="chat-message-list" ref={messageListRef}>
                {loadingMessages ? (
                  <div className="empty-state">Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div className="empty-state">No messages yet. Start the conversation.</div>
                ) : messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-bubble-row ${message.from === "admin" ? "from-admin" : "from-customer"}`}
                  >
                    <div className="chat-bubble">
                      <p>{message.text}</p>
                      <span>{message.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="chat-compose-row">
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
                  disabled={sending || !draft.trim()}
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
