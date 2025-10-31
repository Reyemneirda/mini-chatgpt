import { useState, useEffect } from 'react';
import { api } from './api';
import { Conversation, ConversationDetail, Message } from './types';
import { ConversationList } from './components/ConversationList';
import { ChatArea } from './components/ChatArea';
import './App.css';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [currentConv, setCurrentConv] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletedConvId, setDeletedConvId] = useState<string | null>(null);
  const [deletedConv, setDeletedConv] = useState<Conversation | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      loadConversation(selectedConvId);
    } else {
      setCurrentConv(null);
    }
  }, [selectedConvId]);

  async function loadConversations() {
    try {
      setLoading(true);
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversation(id: string) {
    try {
      const conv = await api.getConversation(id);
      setCurrentConv(conv);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleNewConversation() {
    try {
      const newConv = await api.createConversation();
      setConversations((prev) => [newConv, ...prev]);
      setSelectedConvId(newConv.id);
      setSidebarOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleDeleteConversation(id: string) {
    const convToDelete = conversations.find((c) => c.id === id);
    if (!convToDelete) return;

    // Optimistic delete
    setDeletedConvId(id);
    setDeletedConv(convToDelete);
    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (selectedConvId === id) {
      setSelectedConvId(null);
    }

    // Set timeout to actually delete
    if (undoTimeout) clearTimeout(undoTimeout);
    const timeout = setTimeout(() => {
      performDelete(id);
      setDeletedConvId(null);
      setDeletedConv(null);
    }, 5000);
    setUndoTimeout(timeout);
  }

  async function performDelete(id: string) {
    try {
      await api.deleteConversation(id);
    } catch (err: any) {
      setError(err.message);
      // Restore on error
      if (deletedConv) {
        setConversations((prev) => [deletedConv, ...prev]);
      }
    }
  }

  function handleUndoDelete() {
    if (undoTimeout) clearTimeout(undoTimeout);
    if (deletedConv) {
      setConversations((prev) => [deletedConv, ...prev]);
      setDeletedConvId(null);
      setDeletedConv(null);
    }
  }

  async function handleSendMessage(content: string, abortSignal: AbortSignal) {
    if (!currentConv) return;

    try {
      const result = await api.sendMessage(currentConv.id, content, abortSignal);

      // Add both messages to current conversation
      setCurrentConv((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, result.message, result.reply],
        };
      });

      // Update conversation in list
      await loadConversations();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        throw err;
      }
    }
  }

  return (
    <div className="app">
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConvId}
          onSelect={(id) => {
            setSelectedConvId(id);
            setSidebarOpen(false);
          }}
          onNew={handleNewConversation}
          onDelete={handleDeleteConversation}
        />
      </div>

      <div className="main-content">
        {deletedConvId && (
          <div className="undo-banner">
            <span>Conversation deleted</span>
            <button onClick={handleUndoDelete}>Undo</button>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : !currentConv ? (
          <div className="empty-state">
            <h2>Welcome to Mini ChatGPT</h2>
            <p>Select a conversation or create a new one to get started</p>
            <button onClick={handleNewConversation} className="btn-primary">
              New Conversation
            </button>
          </div>
        ) : (
          <ChatArea
            conversation={currentConv}
            onSendMessage={handleSendMessage}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}
