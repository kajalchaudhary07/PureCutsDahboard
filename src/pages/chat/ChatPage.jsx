import { useMemo, useState } from "react";
import { MdAttachFile, MdCircle, MdSearch, MdSend } from "react-icons/md";

const INITIAL_THREADS = [
  {
    id: "th-101",
    customer: "Rahul Sharma",
    email: "rahul.sharma@example.com",
    avatar: "RS",
    status: "online",
    unread: 2,
    lastSeen: "Typing...",
    messages: [
      {
        id: "m-1",
        from: "customer",
        text: "Hi, can you share delivery timeline for order #PC-3421?",
        time: "10:11 AM",
      },
      {
        id: "m-2",
        from: "admin",
        text: "Sure Rahul. It is packed and should be dispatched by tonight.",
        time: "10:14 AM",
      },
      {
        id: "m-3",
        from: "customer",
        text: "Perfect, thank you.",
        time: "10:15 AM",
      },
    ],
  },
  {
    id: "th-102",
    customer: "Ayesha Khan",
    email: "ayesha.k@example.com",
    avatar: "AK",
    status: "away",
    unread: 0,
    lastSeen: "Today, 09:34 AM",
    messages: [
      {
        id: "m-1",
        from: "customer",
        text: "Need help choosing the right beard wax for sensitive skin.",
        time: "09:30 AM",
      },
      {
        id: "m-2",
        from: "admin",
        text: "I recommend our aloe variant. It has no artificial fragrance.",
        time: "09:34 AM",
      },
    ],
  },
  {
    id: "th-103",
    customer: "Vikram Patel",
    email: "vikram.patel@example.com",
    avatar: "VP",
    status: "offline",
    unread: 1,
    lastSeen: "Yesterday, 08:10 PM",
    messages: [
      {
        id: "m-1",
        from: "customer",
        text: "Can I return an opened product if it causes irritation?",
        time: "08:02 PM",
      },
    ],
  },
];

const statusClass = {
  online: "is-online",
  away: "is-away",
  offline: "is-offline",
};

export default function ChatPage() {
  const [threads, setThreads] = useState(INITIAL_THREADS);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(INITIAL_THREADS[0].id);
  const [draft, setDraft] = useState("");

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const latest = thread.messages[thread.messages.length - 1]?.text || "";
      return (
        thread.customer.toLowerCase().includes(q) ||
        thread.email.toLowerCase().includes(q) ||
        latest.toLowerCase().includes(q)
      );
    });
  }, [query, threads]);

  const activeThread =
    threads.find((thread) => thread.id === selectedId) || filteredThreads[0] || null;

  const sendMessage = () => {
    const message = draft.trim();
    if (!message || !activeThread) return;

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== activeThread.id) return thread;
        return {
          ...thread,
          lastSeen: "Just now",
          messages: [
            ...thread.messages,
            {
              id: `m-${thread.messages.length + 1}`,
              from: "admin",
              text: message,
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ],
        };
      })
    );
    setDraft("");
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Customer Chat</h2>
          <div className="breadcrumb">Home / <span>Chat</span></div>
        </div>
      </div>

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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or message"
            />
          </div>

          <div className="chat-thread-list">
            {filteredThreads.length === 0 ? (
              <div className="empty-state chat-empty">No conversations found.</div>
            ) : (
              filteredThreads.map((thread) => {
                const latest = thread.messages[thread.messages.length - 1]?.text || "No messages yet";
                const isActive = activeThread?.id === thread.id;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    className={`chat-thread-item${isActive ? " active" : ""}`}
                    onClick={() => {
                      setSelectedId(thread.id);
                      setThreads((prev) =>
                        prev.map((item) =>
                          item.id === thread.id ? { ...item, unread: 0 } : item
                        )
                      );
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
                <button type="button" className="btn btn-outline">View Profile</button>
              </div>

              <div className="chat-message-list">
                {activeThread.messages.map((message) => (
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
                <button type="button" className="chat-icon-btn" title="Attach">
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
                <button type="button" className="btn btn-primary" onClick={sendMessage}>
                  <MdSend /> Send
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
