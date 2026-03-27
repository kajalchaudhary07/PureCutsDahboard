import BulkSupportChatbot from "../chat/chatbot/BulkSupportChatbot";

export default function BotPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h2>Boat Assistant</h2>
          <div className="breadcrumb">Home / <span>Boat</span></div>
        </div>
        <p className="bulk-chat-subtitle">
          Guided support flow with question-based options.
        </p>
      </div>

      <BulkSupportChatbot />
    </>
  );
}
