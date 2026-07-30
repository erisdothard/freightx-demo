import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Send, ArrowLeft, Plus, X, Package, User, Loader2, Trash2, MapPin, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { TopHeader } from '@/shared/components/top-header';
import { BottomNav } from '@/shared/components/bottom-nav';
import { cn, getInitials, getNavRole, formatCurrency } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  getOrCreateConversation,
  searchUsers,
} from '@/services/messages.service';
import { getMyActiveLoads, getLoadByNumber } from '@/services/loads.service';
import type { ConversationRow, MessageRow } from '@/lib/database.types';
import type { Load } from '@freightx/shared';
import { SkeletonList } from '@/shared/components/ui/skeleton';
import { EmptyState } from '@/shared/components/empty-state';

/* ── Message Load Context Banner ────────────────────────────────── */
function MessageLoadContext({ loadNumber }: { loadNumber: string }) {
  const { data: load } = useQuery({
    queryKey: ['load-by-number', loadNumber],
    queryFn: () => getLoadByNumber(loadNumber),
    staleTime: 5 * 60_000,
  });

  if (!load) return null;

  return (
    <div className="sticky top-[60px] z-10 bg-fx-surface/90 backdrop-blur-sm border-b border-fx-divider px-4 py-2 flex items-center gap-2">
      <MapPin size={12} className="text-fx-orange shrink-0" />
      <span className="text-[11px] font-bold text-fx-orange">{loadNumber}</span>
      <span className="text-[11px] text-fx-text-dim">
        {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
      </span>
      <span className="ml-auto text-[11px] font-semibold text-fx-text">
        {formatCurrency(load.rateUsd)}
      </span>
    </div>
  );
}

/* ── New Message Sub-Component ─────────────────────────────────── */

function NewMessageContent({
  type,
  onSelectType,
  userId,
  userName: _userName,
  userRole: _userRole,
  onConversationCreated,
}: {
  type: 'load' | 'user' | null;
  onSelectType: (t: 'load' | 'user' | null) => void;
  userId: string;
  userName: string;
  userRole: string;
  onConversationCreated: (convo: ConversationRow) => void;
}) {
  const [myLoads, setMyLoads] = useState<Load[]>([]);
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [userResults, setUserResults] = useState<
    Array<{ id: string; full_name: string | null; email: string; role: string }>
  >([]);
  const [userQuery, setUserQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch loads when load tab is opened
  useEffect(() => {
    if (type !== 'load' || !userId) return;
    setLoadingLoads(true);
    getMyActiveLoads(userId)
      .then(setMyLoads)
      .catch(console.error)
      .finally(() => setLoadingLoads(false));
  }, [type, userId]);

  // Debounced user search
  useEffect(() => {
    if (type !== 'user') return;
    if (!userQuery.trim()) {
      setUserResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchingUsers(true);
      searchUsers(userQuery.trim(), userId)
        .then(setUserResults)
        .catch(console.error)
        .finally(() => setSearchingUsers(false));
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [userQuery, type, userId]);

  async function handleSelectLoad(load: Load) {
    if (creating) return;
    setCreating(true);
    try {
      const convo = await getOrCreateConversation(
        userId,
        load.postedBy || userId,
        load.companyName,
        'broker',
        load.loadNumber,
      );
      onConversationCreated(convo);
    } catch (e) {
      console.error('Failed to create conversation:', e);
    } finally {
      setCreating(false);
    }
  }

  async function handleSelectUser(u: {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  }) {
    if (creating) return;
    setCreating(true);
    try {
      const convo = await getOrCreateConversation(userId, u.id, u.full_name ?? u.email, u.role);
      onConversationCreated(convo);
    } catch (e) {
      console.error('Failed to create conversation:', e);
    } finally {
      setCreating(false);
    }
  }

  if (!type) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-fx-text-muted mb-4">
          Choose how you want to start a conversation:
        </p>
        <button
          onClick={() => onSelectType('load')}
          className="w-full bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center gap-3 hover:bg-fx-surface-2 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center">
            <Package size={22} className="text-fx-orange" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-fx-text">Message about a Load</p>
            <p className="text-xs text-fx-text-muted">
              Start a conversation tied to a specific load
            </p>
          </div>
        </button>
        <button
          onClick={() => onSelectType('user')}
          className="w-full bg-fx-surface border border-fx-border rounded-2xl p-4 flex items-center gap-3 hover:bg-fx-surface-2 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center">
            <User size={22} className="text-fx-orange" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-fx-text">Message a User</p>
            <p className="text-xs text-fx-text-muted">Browse and message any user directly</p>
          </div>
        </button>
      </div>
    );
  }

  if (type === 'load') {
    return (
      <div className="space-y-4">
        <button onClick={() => onSelectType(null)} className="text-sm text-fx-orange font-medium">
          ← Back
        </button>
        <p className="text-sm text-fx-text-muted">Select a load to start a conversation about:</p>
        {loadingLoads ? (
          <SkeletonList count={3} />
        ) : myLoads.length === 0 ? (
          <EmptyState
            icon={<Package size={28} className="text-fx-text-dim" />}
            title="No active loads found"
            subtitle="Post or accept a load to start messaging"
          />
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-hide">
            {myLoads.map((load) => (
              <button
                key={load.id}
                onClick={() => handleSelectLoad(load)}
                disabled={creating}
                className="w-full text-left bg-fx-surface border border-fx-border rounded-2xl p-3 flex items-center gap-3 hover:border-fx-orange/40 transition-colors disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-fx-orange/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {load.companyLogoUrl ? (
                    <img
                      src={load.companyLogoUrl}
                      alt={load.companyName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={16} className="text-fx-orange" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-fx-orange">{load.loadNumber}</p>
                  <p className="text-xs text-fx-text-muted truncate">
                    {load.originCity}, {load.originState} → {load.destCity}, {load.destState}
                  </p>
                  <p className="text-[10px] text-fx-text-dim truncate mt-0.5">{load.companyName}</p>
                </div>
                <span className="text-[10px] font-bold text-fx-text-dim bg-fx-surface-2 px-2 py-0.5 rounded-full">
                  {load.status === 'in_transit'
                    ? 'In Transit'
                    : load.status === 'dispatched'
                      ? 'Dispatched'
                      : 'Active'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // type === 'user'
  return (
    <div className="space-y-4">
      <button onClick={() => onSelectType(null)} className="text-sm text-fx-orange font-medium">
        ← Back
      </button>
      <p className="text-sm text-fx-text-muted">Search for a user to message:</p>
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-orange" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          className="w-full h-10 bg-fx-surface border border-fx-border rounded-xl pl-10 pr-4 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange outline-none"
        />
      </div>
      {searchingUsers ? (
        <SkeletonList count={3} />
      ) : userResults.length > 0 ? (
        <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-hide">
          {userResults.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSelectUser(u)}
              disabled={creating}
              className="w-full text-left bg-fx-surface border border-fx-border rounded-2xl p-3 flex items-center gap-3 hover:border-fx-orange/40 transition-colors disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-fx-orange/10 flex items-center justify-center shrink-0">
                <User size={16} className="text-fx-orange" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fx-text truncate">
                  {u.full_name ?? u.email}
                </p>
                <p className="text-xs text-fx-text-dim truncate">{u.email}</p>
              </div>
              <span className="text-[10px] font-bold text-fx-text-dim bg-fx-surface-2 px-2 py-0.5 rounded-full capitalize">
                {u.role}
              </span>
            </button>
          ))}
        </div>
      ) : userQuery.trim() ? (
        <EmptyState
          icon={<User size={28} className="text-fx-text-dim" />}
          title="No users found"
          subtitle="Try a different name or email"
        />
      ) : null}
    </div>
  );
}

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Track if user arrived from another page (load detail, bid sheet, etc.)
  const cameFromOutside = useRef(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newMessageType, setNewMessageType] = useState<'load' | 'user' | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const role = getNavRole(profile?.role);

  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Load conversations, then auto-select if navigated from load detail
  useEffect(() => {
    if (!user) return;
    getConversations(user.id)
      .then(({ data: convos }) => {
        setConversations(convos);
        const incoming = (location.state as { openConversation?: ConversationRow } | null)
          ?.openConversation;
        if (incoming) {
          const match = convos.find((c) => c.id === incoming.id) ?? incoming;
          setSelected(match);
          cameFromOutside.current = true;
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchMessages = useCallback((id: string) => {
    getMessages(id)
      .then(({ data, hasMore }) => {
        setMessages(data);
        setHasMoreMessages(hasMore);
      })
      .catch(console.error);
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!selected || !hasMoreMessages || loadingOlder) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const { data, hasMore } = await getMessages(selected.id, { before: oldest.created_at });
      setMessages((prev) => [...data, ...prev]);
      setHasMoreMessages(hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOlder(false);
    }
  }, [selected, hasMoreMessages, loadingOlder, messages]);

  // Load + live-subscribe to messages when a conversation is selected
  useEffect(() => {
    if (!selected) return;
    fetchMessages(selected.id);

    const channel = supabase
      .channel(`convo-${selected.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selected.id}`,
        },
        () => fetchMessages(selected.id),
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selected.id}`,
        },
        () => fetchMessages(selected.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || !selected || !user) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    await sendMessage(selected.id, user.id, text).catch(console.error);
    // Realtime will trigger fetchMessages; call manually as fallback
    fetchMessages(selected.id);
    setSending(false);
  }

  async function handleDelete(msgId: string) {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteMessage(msgId);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      setSelectedMsgId(null);
    } catch {
      console.error('Failed to delete message');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = conversations.filter(
    (c) =>
      !search ||
      c.other_party.toLowerCase().includes(search.toLowerCase()) ||
      (c.load_number ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (selected) {
    const initials = getInitials(selected.other_party);
    return (
      <div className="min-h-dvh flex flex-col pb-[84px]">
        {/* Chat header */}
        <div className="sticky top-0 z-20 bg-fx-bg/80 backdrop-blur-md border-b border-fx-border px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (cameFromOutside.current) {
                cameFromOutside.current = false;
                navigate(-1);
              } else {
                setSelected(null);
              }
            }}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-fx-surface transition-colors"
          >
            <ArrowLeft size={18} className="text-fx-text" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-fx-orange/10 border border-fx-orange/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-fx-orange">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-fx-text leading-tight">{selected.other_party}</p>
            {selected.load_number && (
              <p className="text-xs text-fx-orange">{selected.load_number}</p>
            )}
          </div>
        </div>

        {/* Load context banner */}
        {selected.load_number && (
          <MessageLoadContext loadNumber={selected.load_number} />
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {hasMoreMessages && (
            <button
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="w-full py-2 text-xs text-fx-text-muted hover:text-fx-accent transition-colors"
            >
              {loadingOlder ? 'Loading...' : 'Load older messages'}
            </button>
          )}
          {messages.length === 0 ? (
            <EmptyState
              icon={<Send size={24} className="text-fx-text-dim" />}
              title="No messages yet"
              subtitle="Say hello!"
            />
          ) : (
            messages.map((msg) => {
              const isSelected = selectedMsgId === msg.id;
              return (
                <div
                  key={msg.id}
                  className={cn('flex', msg.from_me ? 'justify-end' : 'justify-start')}
                >
                  <div className="relative max-w-[75%]">
                    <div
                      onClick={() =>
                        msg.sender_id === user?.id
                          ? setSelectedMsgId(isSelected ? null : msg.id)
                          : undefined
                      }
                      className={cn(
                        'rounded-2xl px-4 py-2.5 transition-all',
                        msg.from_me
                          ? 'bg-fx-orange text-white rounded-br-sm'
                          : 'bg-fx-surface border border-fx-border text-fx-text rounded-bl-sm',
                        msg.sender_id === user?.id && 'cursor-pointer',
                        isSelected && 'ring-2 ring-red-400/50',
                      )}
                    >
                      <p className="text-sm leading-snug">{msg.text}</p>
                      <p
                        className={cn(
                          'text-[10px] mt-1',
                          msg.from_me ? 'text-white/60 text-right' : 'text-fx-text-dim',
                        )}
                      >
                        {new Date(msg.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {isSelected && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        disabled={deleting}
                        className="absolute -top-3 right-0 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} className="text-white" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-4 flex gap-2 items-end">
          <input
            type="text"
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 h-12 bg-fx-surface border border-fx-border rounded-2xl px-4 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="w-12 h-12 bg-fx-orange rounded-2xl flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Send size={18} className="text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col pb-[84px]">
      <TopHeader
        title="Messages"
        notificationCount={conversations.filter((c) => c.unread_count > 0).length}
      />

      {/* Search */}
      <div className="px-5 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fx-orange" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 bg-fx-surface border border-fx-border rounded-2xl pl-10 pr-4 text-sm text-fx-text placeholder:text-fx-text-dim focus:border-fx-orange focus:ring-1 focus:ring-fx-orange/30 outline-none transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={36} className="text-fx-text-dim" />}
            title="No messages yet"
            subtitle="Your conversations will appear here"
          />
        ) : (
          <div className="divide-y divide-fx-border">
            {filtered.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setSelected(convo)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-fx-surface transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-fx-surface border border-fx-border flex items-center justify-center">
                    <span className="text-sm font-bold text-fx-orange">
                      {getInitials(convo.other_party)}
                    </span>
                  </div>
                  {convo.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-fx-orange rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{convo.unread_count}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between">
                    <p
                      className={cn(
                        'text-sm font-semibold truncate',
                        convo.unread_count > 0 ? 'text-fx-text' : 'text-fx-text-muted',
                      )}
                    >
                      {convo.other_party}
                    </p>
                    <span className="text-[10px] text-fx-text-dim shrink-0 ml-2">
                      {new Date(convo.last_message_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {convo.last_message && (
                    <p
                      className={cn(
                        'text-xs truncate mt-0.5',
                        convo.unread_count > 0 ? 'text-fx-text-muted' : 'text-fx-text-dim',
                      )}
                    >
                      {convo.last_message}
                    </p>
                  )}
                  {convo.load_number && (
                    <p className="text-[10px] text-fx-orange font-semibold mt-0.5">
                      {convo.load_number}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Message FAB */}
      <button
        onClick={() => setShowNewMessage(true)}
        className="fixed bottom-24 right-5 w-14 h-14 bg-orange-gradient rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity z-30"
        style={{ boxShadow: '0 4px 20px rgba(232,96,48,0.5)' }}
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* New Message Modal */}
      {showNewMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-fx-bg rounded-t-3xl p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-fx-text">New Message</h2>
              <button
                onClick={() => {
                  setShowNewMessage(false);
                  setNewMessageType(null);
                }}
                className="w-8 h-8 rounded-full bg-fx-surface flex items-center justify-center"
              >
                <X size={18} className="text-fx-text-dim" />
              </button>
            </div>

            <NewMessageContent
              type={newMessageType}
              onSelectType={setNewMessageType}
              userId={user?.id ?? ''}
              userName={profile?.full_name ?? profile?.email ?? ''}
              userRole={profile?.role ?? 'carrier'}
              onConversationCreated={(convo) => {
                setShowNewMessage(false);
                setNewMessageType(null);
                // Refresh conversations and open the new one
                if (user)
                  getConversations(user.id)
                    .then(({ data: convos }) => setConversations(convos))
                    .catch(console.error);
                setSelected(convo);
              }}
            />
          </div>
        </div>
      )}

      <BottomNav role={role as any} />
    </div>
  );
}
