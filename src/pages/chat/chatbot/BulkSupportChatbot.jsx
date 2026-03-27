import { useEffect, useRef, useState } from "react";
import { MdSend } from "react-icons/md";
import { useBulkSupportChatbot } from "./useBulkSupportChatbot";

export default function BulkSupportChatbot() {
  const { state, chooseOption, sendUserText, reset } = useBulkSupportChatbot();
  const messagesRef = useRef(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [state.messages]);

  const onSend = () => {
    const value = draft.trim();
    if (!value) return;
    sendUserText(value);
    setDraft("");
  };

  return (
    <section className="card bulk-bot-shell">
      <header className="bulk-bot-header">
        <div>
          <h3>PureCuts Bulk Support Bot</h3>
          <p>Start with any message. Then use guided options in chat.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={reset}>
          Restart
        </button>
      </header>

      <div className="bulk-bot-messages" ref={messagesRef}>
        {state.messages.map((message) => {
          const showInlineOptions =
            message.role === "bot" &&
            message.id === state.activeQuestionId &&
            state.currentOptions.length > 0;

          return (
            <div
              key={message.id}
              className={`bulk-bot-row ${message.role === "user" ? "from-user" : "from-bot"}`}
            >
              <div className="bulk-bot-msg-wrap">
                <div className="bulk-bot-bubble">{message.text}</div>

                {showInlineOptions ? (
                  <div className="bulk-bot-inline-options">
                    {state.currentOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`btn ${option.variant === "primary" ? "btn-primary" : "btn-outline"}`}
                        onClick={() => chooseOption(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="bulk-bot-footer">
        <div className="bulk-bot-compose-row">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSend();
            }}
            placeholder="Type hii to start"
          />

          <button type="button" className="btn btn-primary" onClick={onSend} disabled={!draft.trim()}>
            <MdSend /> Send
          </button>
        </div>
      </footer>
    </section>
  );
}
