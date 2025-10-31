import { Conversation } from '../types';
import './ConversationList.css';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect, onNew, onDelete }: Props) {
  return (
    <div className="conversation-list">
      <button className="btn-new-conversation" onClick={onNew}>
        + New Conversation
      </button>

      <div className="conversations">
        {conversations.length === 0 ? (
          <div className="empty-conversations">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${selectedId === conv.id ? 'selected' : ''}`}
              onClick={() => onSelect(conv.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(conv.id);
                }
              }}
            >
              <div className="conversation-title">{conv.title}</div>
              <button
                className="btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                aria-label={`Delete ${conv.title}`}
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
