import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tutor, ChatMessage, Conversation, TimeSlot, Booking } from '../types';
import { supabase, isValidUuid, resolveUserUuid } from '../lib/supabase';
import { X, Send, MessageSquare, Sparkles, Search, CheckCheck, Trash2, Calendar, AlertCircle, Video, CheckCircle2, ArrowRight } from 'lucide-react';

interface ChatWidgetProps {
  currentUser: { id: string; name: string; email: string; role: 'student' | 'teacher'; tutorProfileId?: string; avatarUrl?: string };
  initialTutorToChat?: Tutor | null;
  tutors?: Tutor[];
  bookings?: Booking[];
  onBookLesson?: (tutorId: string, slot: TimeSlot, studentName: string, studentEmail: string, note: string) => void;
  onStartLiveLesson?: (booking: Booking) => void;
  onOpenMyBookings?: () => void;
  onClose: () => void;
}

interface DbUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  avatar_url?: string;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  currentUser,
  initialTutorToChat,
  tutors = [],
  bookings = [],
  onBookLesson,
  onStartLiveLesson,
  onOpenMyBookings,
  onClose
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [myUuid, setMyUuid] = useState<string | null>(() => isValidUuid(currentUser.id) ? currentUser.id : null);
  const [usersMap, setUsersMap] = useState<Map<string, DbUser>>(() => {
    const map = new Map<string, DbUser>();
    try {
      const cached = localStorage.getItem('cached_db_users');
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list)) {
          list.forEach((u: any) => {
            const parsedName = u.name && u.name.trim() !== '' && u.name !== 'תלמיד' 
              ? u.name 
              : (u.email ? u.email.split('@')[0] : 'משתמש');
            const item = {
              id: u.id,
              name: parsedName,
              email: u.email || '',
              role: u.role || 'student',
              avatar_url: u.avatar_url
            };
            map.set(u.id, item);
            if (u.email) {
              map.set(u.email.toLowerCase(), item);
            }
          });
        }
      }
      const reg = localStorage.getItem('registered_users');
      if (reg) {
        const regList = JSON.parse(reg);
        if (Array.isArray(regList)) {
          regList.forEach((u: any) => {
            if (u.id && !map.has(u.id)) {
              map.set(u.id, { id: u.id, name: u.name, email: u.email || '', role: u.role || 'student' });
            }
            if (u.email && !map.has(u.email.toLowerCase())) {
              map.set(u.email.toLowerCase(), { id: u.id || u.email, name: u.name, email: u.email, role: u.role || 'student' });
            }
          });
        }
      }
    } catch (e) {}
    return map;
  });
  
  // In-Chat Booking State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingNote, setBookingNote] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to scroll to bottom of chat
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Helper to render an avatar consistently across all chat elements
  const renderAvatarNode = (avatarString?: string, name?: string, sizeClass: string = 'w-10 h-10', textClass: string = 'text-base') => {
    const cleanName = (name || '?').trim();
    if (avatarString) {
      if (avatarString.startsWith('preset:')) {
        const parts = avatarString.split(':');
        const emoji = parts[1] || '👨‍🏫';
        const bg = parts[2] || 'from-indigo-500 to-purple-600';
        return (
          <div className={`${sizeClass} rounded-full bg-gradient-to-br ${bg} flex items-center justify-center text-lg shadow-2xs border border-slate-100 shrink-0 select-none`}>
            {emoji}
          </div>
        );
      }
      return (
        <img
          src={avatarString}
          alt={cleanName}
          className={`${sizeClass} rounded-full object-cover shadow-2xs border border-slate-100 shrink-0`}
        />
      );
    }
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold ${textClass} shadow-2xs shrink-0 select-none`}>
        {cleanName ? cleanName.charAt(0) : '?'}
      </div>
    );
  };

  // 1. Fetch all users from Supabase and resolve current user's UUID
  useEffect(() => {
    let isMounted = true;

    const loadUsersAndResolveMe = async () => {
      try {
        const { data: usersData, error } = await supabase
          .from('users')
          .select('*');

        if (!error && usersData && isMounted) {
          try {
            localStorage.setItem('cached_db_users', JSON.stringify(usersData));
          } catch (e) {}

          const map = new Map<string, DbUser>();
          usersData.forEach((u: any) => {
            const parsedName = u.name && u.name.trim() !== '' && u.name !== 'תלמיד' 
              ? u.name 
              : (u.email ? u.email.split('@')[0] : 'משתמש');
            const resolvedAvatar = u.avatar || u.avatar_url || u.avatarUrl;
            const item = {
              id: u.id,
              name: parsedName,
              email: u.email || '',
              role: u.role || 'student',
              avatar_url: resolvedAvatar
            };
            map.set(u.id, item);
            if (u.email) {
              map.set(u.email.toLowerCase(), item);
            }
          });
          setUsersMap(map);

          // Find current user's UUID in the map
          const myMatch = map.get(currentUser.email.toLowerCase()) || (isValidUuid(currentUser.id) ? map.get(currentUser.id) : null);
          if (myMatch) {
            setMyUuid(myMatch.id);
          } else {
            const resolved = await resolveUserUuid(currentUser);
            if (resolved && isMounted) {
              setMyUuid(resolved);
            }
          }
        } else if (!myUuid) {
          const resolved = await resolveUserUuid(currentUser);
          if (resolved && isMounted) {
            setMyUuid(resolved);
          }
        }
      } catch (err) {
        console.error('Error fetching users in ChatWidget:', err);
      }
    };

    loadUsersAndResolveMe();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // 2. Full synchronization of conversations and messages from Supabase
  const syncAllConversationsFromSupabase = useCallback(async () => {
    if (!myUuid || !isValidUuid(myUuid)) return;

    try {
      // Fetch latest users to always have fresh names and avatars
      const { data: latestUsers } = await supabase
        .from('users')
        .select('*');

      const freshUsersMap = new Map<string, DbUser>(usersMap);
      if (latestUsers && Array.isArray(latestUsers)) {
        try {
          localStorage.setItem('cached_db_users', JSON.stringify(latestUsers));
        } catch (e) {}

        latestUsers.forEach((u: any) => {
          const parsedName = u.name && u.name.trim() !== '' && u.name !== 'תלמיד' 
            ? u.name 
            : (u.email ? u.email.split('@')[0] : 'משתמש');
          const resolvedAvatar = u.avatar || u.avatar_url || u.avatarUrl;
          const item = {
            id: u.id,
            name: parsedName,
            email: u.email || '',
            role: u.role || 'student',
            avatar_url: resolvedAvatar
          };
          freshUsersMap.set(u.id, item);
          if (u.email) {
            freshUsersMap.set(u.email.toLowerCase(), item);
          }
        });
        setUsersMap(freshUsersMap);
      }

      console.log("Fetching chat messages from Supabase for UUID:", myUuid);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myUuid},receiver_id.eq.${myUuid}`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error fetching messages from Supabase:", error);
        return;
      }

      if (data && Array.isArray(data)) {
        // Group messages by partner UUID
        const convMap = new Map<string, Conversation>();

        data.forEach((row: any) => {
          const senderUuid = row.sender_id;
          const receiverUuid = row.receiver_id;
          const isSenderMe = senderUuid === myUuid;
          const partnerUuid = isSenderMe ? receiverUuid : senderUuid;

          if (!partnerUuid) return;

          // Lookup partner info from fresh map and tutors
          const partnerUser = freshUsersMap.get(partnerUuid) || freshUsersMap.get(partnerUuid.toLowerCase());
          const partnerTutor = tutors.find(t => t.id === partnerUuid || (partnerUser && t.email.toLowerCase() === partnerUser.email.toLowerCase()));

          let tutorId = '';
          let tutorName = '';
          let tutorEmail = '';
          let studentEmail = '';
          let studentName = '';

          if (currentUser.role === 'teacher') {
            tutorId = myUuid;
            tutorName = currentUser.name;
            tutorEmail = currentUser.email;
            studentEmail = partnerUser?.email || '';
            studentName = (partnerUser?.name && partnerUser.name !== 'תלמיד') 
              ? partnerUser.name 
              : (partnerUser?.email ? partnerUser.email.split('@')[0] : '');
          } else {
            studentEmail = currentUser.email;
            studentName = currentUser.name;
            tutorId = partnerTutor?.id || partnerUuid;
            tutorName = partnerTutor?.name || (partnerUser?.name && partnerUser.name !== 'תלמיד' ? partnerUser.name : 'מורה פרטי');
            tutorEmail = partnerTutor?.email || partnerUser?.email || '';
          }

          const convId = partnerUuid;

          if (!convMap.has(convId)) {
            convMap.set(convId, {
              id: convId,
              tutorId,
              tutorName,
              tutorEmail,
              studentEmail,
              studentName,
              messages: [],
              lastMessageAt: row.created_at || new Date().toISOString(),
              unreadCount: {
                [tutorEmail]: 0,
                [studentEmail]: 0
              }
            });
          }

          const conv = convMap.get(convId)!;
          // Update studentName if it became available
          if (studentName && (!conv.studentName || conv.studentName === 'תלמיד')) {
            conv.studentName = studentName;
          }
          if (studentEmail && !conv.studentEmail) {
            conv.studentEmail = studentEmail;
          }

          const msgObj: ChatMessage = {
            id: row.id?.toString() || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            senderId: senderUuid,
            senderName: isSenderMe ? currentUser.name : (currentUser.role === 'teacher' ? (studentName || 'תלמיד') : tutorName),
            text: row.text || row.content || row.message || '',
            timestamp: row.created_at || new Date().toISOString()
          };
          conv.messages.push(msgObj);
          conv.lastMessageAt = msgObj.timestamp;

          // Track unread status
          if (!isSenderMe && row.is_read === false) {
            conv.unreadCount[currentUser.email] = (conv.unreadCount[currentUser.email] || 0) + 1;
          }
        });

        const remoteConvs = Array.from(convMap.values());

        setConversations(prev => {
          // Preserve any newly opened conversations with no messages yet
          const mergedMap = new Map<string, Conversation>();
          prev.forEach(c => {
            if (c.messages.length === 0) {
              mergedMap.set(c.id, c);
            }
          });
          remoteConvs.forEach(rc => mergedMap.set(rc.id, rc));

          const mergedList = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );

          localStorage.setItem('tutor_conversations', JSON.stringify(mergedList));
          return mergedList;
        });
      }
    } catch (err) {
      console.error("Error in syncAllConversationsFromSupabase:", err);
    }
  }, [myUuid, currentUser, usersMap, tutors]);

  // 3. Periodic Polling (every 2000ms) and Realtime Subscription
  useEffect(() => {
    if (!myUuid) return;

    // Immediately sync from Supabase
    syncAllConversationsFromSupabase();

    const interval = setInterval(() => {
      syncAllConversationsFromSupabase();
    }, 2000);

    // Realtime subscription
    const channel = supabase
      .channel(`chat-realtime-user-${myUuid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload: any) => {
          const newRow = payload.new;
          if (!newRow) {
            syncAllConversationsFromSupabase();
            return;
          }

          if (newRow.sender_id === myUuid || newRow.receiver_id === myUuid) {
            syncAllConversationsFromSupabase();
            setTimeout(() => scrollToBottom('smooth'), 100);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [myUuid, syncAllConversationsFromSupabase]);

  // 4. Initialize active conversation when initialTutorToChat is provided
  useEffect(() => {
    if (!initialTutorToChat) return;

    const setupInitialChat = async () => {
      let targetTutorUuid = isValidUuid(initialTutorToChat.id) ? initialTutorToChat.id : null;
      
      if (!targetTutorUuid) {
        const found = usersMap.get(initialTutorToChat.email.toLowerCase());
        if (found && isValidUuid(found.id)) {
          targetTutorUuid = found.id;
        } else {
          targetTutorUuid = await resolveUserUuid({
            name: initialTutorToChat.name,
            email: initialTutorToChat.email,
            role: 'teacher'
          });
        }
      }

      if (targetTutorUuid) {
        const convId = targetTutorUuid;
        setActiveConvId(convId);

        setConversations(prev => {
          const existing = prev.find(c => c.id === convId);
          if (!existing) {
            const newConv: Conversation = {
              id: convId,
              tutorId: targetTutorUuid!,
              tutorName: initialTutorToChat.name,
              tutorEmail: initialTutorToChat.email,
              studentEmail: currentUser.email,
              studentName: currentUser.name,
              messages: [],
              lastMessageAt: new Date().toISOString(),
              unreadCount: {
                [initialTutorToChat.email]: 0,
                [currentUser.email]: 0
              }
            };
            return [newConv, ...prev];
          }
          return prev;
        });
      }
    };

    setupInitialChat();
  }, [initialTutorToChat, currentUser, usersMap]);

  // 5. Auto-select first conversation ONLY on desktop if none selected
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      if (!activeConvId && !initialTutorToChat && conversations.length > 0) {
        setActiveConvId(conversations[0].id);
      }
    }
  }, [activeConvId, initialTutorToChat, conversations]);

  // 6. Mark conversation messages as read
  const markAsRead = async (convPartnerUuid: string) => {
    if (!myUuid || !isValidUuid(myUuid) || !isValidUuid(convPartnerUuid)) return;

    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === convPartnerUuid) {
          return {
            ...c,
            unreadCount: {
              ...c.unreadCount,
              [currentUser.email]: 0
            }
          };
        }
        return c;
      });
      localStorage.setItem('tutor_conversations', JSON.stringify(updated));
      return updated;
    });

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', convPartnerUuid)
        .eq('receiver_id', myUuid)
        .eq('is_read', false);
    } catch (e) {}
  };

  useEffect(() => {
    if (activeConvId) {
      markAsRead(activeConvId);
      scrollToBottom('smooth');
    }
  }, [activeConvId, myUuid]);

  // Helper to dynamically resolve opponent name and info
  const getOpponentName = useCallback((conv: Conversation) => {
    const partnerId = conv.id;
    const studentEmail = (conv.studentEmail || '').toLowerCase();
    const tutorEmail = (conv.tutorEmail || '').toLowerCase();

    // Look up in usersMap by ID and by Email
    const userById = usersMap.get(partnerId) || usersMap.get(partnerId.toLowerCase());
    const userByStudentEmail = studentEmail ? (usersMap.get(studentEmail) || usersMap.get(studentEmail.toLowerCase())) : undefined;
    const userByTutorEmail = tutorEmail ? (usersMap.get(tutorEmail) || usersMap.get(tutorEmail.toLowerCase())) : undefined;
    const matchedUser = userById || (currentUser.role === 'teacher' ? userByStudentEmail : userByTutorEmail);

    // Look up in tutors list
    const matchedTutor = tutors.find(t => 
      t.id === partnerId || 
      (tutorEmail && t.email.toLowerCase() === tutorEmail) ||
      (matchedUser && t.email.toLowerCase() === matchedUser.email.toLowerCase())
    );

    // Look up sender names from messages
    let senderNameFromMsgs = '';
    if (conv.messages && conv.messages.length > 0) {
      const otherMsgs = conv.messages.filter(m => 
        m.senderId !== myUuid && 
        m.senderId !== currentUser.email && 
        m.senderId !== currentUser.id
      );
      for (let i = otherMsgs.length - 1; i >= 0; i--) {
        const m = otherMsgs[i];
        if (m.senderName && m.senderName.trim() !== '' && m.senderName !== 'תלמיד' && m.senderName !== 'מורה פרטי') {
          senderNameFromMsgs = m.senderName.trim();
          break;
        }
        // Also check if senderId has user in usersMap
        const msgUser = usersMap.get(m.senderId);
        if (msgUser?.name && msgUser.name.trim() !== '' && msgUser.name !== 'תלמיד') {
          senderNameFromMsgs = msgUser.name.trim();
          break;
        }
      }
    }

    if (currentUser.role === 'teacher') {
      // 1. Check matched User from usersMap
      if (matchedUser?.name && matchedUser.name.trim() !== '' && matchedUser.name !== 'תלמיד') {
        return matchedUser.name;
      }
      // 2. Check cached_db_users in localStorage
      try {
        const cached = localStorage.getItem('cached_db_users');
        if (cached) {
          const cList = JSON.parse(cached);
          if (Array.isArray(cList)) {
            const found = cList.find((u: any) => 
              (u.id && (u.id === partnerId || u.id === conv.id)) || 
              (studentEmail && u.email && u.email.toLowerCase() === studentEmail)
            );
            if (found?.name && found.name.trim() !== '' && found.name !== 'תלמיד') {
              return found.name;
            }
            if (found?.email) {
              return found.email.split('@')[0];
            }
          }
        }
      } catch (e) {}

      // 3. Check registered_users in local storage
      try {
        const stored = localStorage.getItem('registered_users');
        if (stored) {
          const reg = JSON.parse(stored);
          if (Array.isArray(reg)) {
            const found = reg.find((u: any) => 
              (u.id && (u.id === partnerId || u.id === conv.id)) || 
              (studentEmail && u.email && u.email.toLowerCase() === studentEmail)
            );
            if (found?.name && found.name.trim() !== '' && found.name !== 'תלמיד') {
              return found.name;
            }
          }
        }
      } catch (e) {}

      // 4. Check sender name in messages
      if (senderNameFromMsgs) {
        return senderNameFromMsgs;
      }
      // 5. Check conv.studentName
      if (conv.studentName && conv.studentName.trim() !== '' && conv.studentName !== 'תלמיד') {
        return conv.studentName;
      }

      // 6. Check messages senders in usersMap or cached
      if (conv.messages && conv.messages.length > 0) {
        for (const m of conv.messages) {
          if (m.senderId && m.senderId !== myUuid && m.senderId !== currentUser.email && m.senderId !== currentUser.id) {
            const u = usersMap.get(m.senderId);
            if (u?.name && u.name.trim() !== '' && u.name !== 'תלמיד') {
              return u.name;
            }
            if (u?.email) {
              return u.email.split('@')[0];
            }
          }
        }
      }

      // 7. Fallback to email handle (e.g. "nivdorf" / "abcs")
      if (matchedUser?.email && matchedUser.email.includes('@')) {
        return matchedUser.email.split('@')[0];
      }
      if (conv.studentEmail && conv.studentEmail.includes('@') && !conv.studentEmail.includes('example.com')) {
        return conv.studentEmail.split('@')[0];
      }
      return 'משתמש';
    } else {
      // Student viewing Teacher
      if (matchedTutor?.name && matchedTutor.name.trim() !== '' && matchedTutor.name !== 'מורה פרטי') {
        return matchedTutor.name;
      }
      if (matchedUser?.name && matchedUser.name.trim() !== '' && matchedUser.name !== 'תלמיד' && matchedUser.name !== 'מורה פרטי') {
        return matchedUser.name;
      }
      if (senderNameFromMsgs) {
        return senderNameFromMsgs;
      }
      if (conv.tutorName && conv.tutorName.trim() !== '' && conv.tutorName !== 'מורה פרטי') {
        return conv.tutorName;
      }
      if (matchedTutor?.email) {
        return matchedTutor.email.split('@')[0];
      }
      if (matchedUser?.email) {
        return matchedUser.email.split('@')[0];
      }
      return 'מורה פרטי';
    }
  }, [currentUser.role, currentUser.email, currentUser.id, myUuid, usersMap, tutors]);

  // Helper to extract avatar for any user id or email or tutor
  const getUserAvatar = useCallback((identifier?: string): string | undefined => {
    if (!identifier) return undefined;
    const cleanId = identifier.trim().toLowerCase();

    // 1. Current user check
    if (
      (currentUser.id && currentUser.id === identifier) ||
      (currentUser.email && currentUser.email.toLowerCase() === cleanId) ||
      (myUuid && myUuid === identifier)
    ) {
      const dbMe = usersMap.get(currentUser.id || '') || usersMap.get(currentUser.email?.toLowerCase() || '') || (myUuid ? usersMap.get(myUuid) : undefined);
      return dbMe?.avatar_url || currentUser.avatarUrl;
    }

    // 2. UsersMap lookup
    const dbUser = usersMap.get(identifier) || usersMap.get(cleanId);
    if (dbUser?.avatar_url) {
      return dbUser.avatar_url;
    }

    // 3. Tutors list lookup
    const matchedTutor = tutors.find(t => 
      t.id === identifier || 
      (t.email && t.email.toLowerCase() === cleanId) ||
      (t.name && t.name.toLowerCase() === cleanId)
    );
    if (matchedTutor?.avatarUrl) {
      return matchedTutor.avatarUrl;
    }

    return undefined;
  }, [currentUser, myUuid, usersMap, tutors]);

  // Helper to extract the opponent avatar (photo or preset)
  const getOpponentAvatar = useCallback((conv: Conversation): string | undefined => {
    const partnerId = conv.id;
    const studentEmail = (conv.studentEmail || '').toLowerCase();
    const tutorEmail = (conv.tutorEmail || '').toLowerCase();

    // Look up in usersMap by ID and by Email
    const userById = usersMap.get(partnerId) || usersMap.get(partnerId.toLowerCase());
    const userByStudentEmail = studentEmail ? (usersMap.get(studentEmail) || usersMap.get(studentEmail.toLowerCase())) : undefined;
    const userByTutorEmail = tutorEmail ? (usersMap.get(tutorEmail) || usersMap.get(tutorEmail.toLowerCase())) : undefined;
    const matchedUser = userById || (currentUser.role === 'teacher' ? userByStudentEmail : userByTutorEmail) || userByStudentEmail || userByTutorEmail;

    const matchedTutor = tutors.find(t => 
      t.id === partnerId || 
      (tutorEmail && t.email && t.email.toLowerCase() === tutorEmail) ||
      (matchedUser?.email && t.email && t.email.toLowerCase() === matchedUser.email.toLowerCase())
    );

    return matchedUser?.avatar_url || matchedTutor?.avatarUrl;
  }, [currentUser.role, usersMap, tutors]);

  // Filter conversations based on current user role and search query
  const filteredConversations = conversations.filter(c => {
    const opponentName = getOpponentName(c);
    return opponentName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 7. Send Message (Inserts UUIDs into Supabase 'messages' table)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId) return;

    let senderUuid = myUuid;
    if (!senderUuid || !isValidUuid(senderUuid)) {
      senderUuid = await resolveUserUuid(currentUser);
      if (senderUuid) setMyUuid(senderUuid);
    }

    if (!senderUuid || !isValidUuid(senderUuid)) {
      console.error("Could not resolve valid sender UUID");
      return;
    }

    const targetPartnerUuid = activeConvId;
    if (!isValidUuid(targetPartnerUuid)) {
      console.error("Target partner ID is not a valid UUID:", targetPartnerUuid);
      return;
    }

    const messageText = inputText.trim();
    const msgId = `msg-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const newMessage: ChatMessage = {
      id: msgId,
      senderId: senderUuid,
      senderName: currentUser.name,
      text: messageText,
      timestamp
    };

    // Update local state immediately for responsive instant feedback
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === activeConvId) {
          return {
            ...c,
            messages: [...c.messages, newMessage],
            lastMessageAt: timestamp
          };
        }
        return c;
      });
      localStorage.setItem('tutor_conversations', JSON.stringify(updated));
      return updated;
    });

    setInputText('');
    setTimeout(() => scrollToBottom('smooth'), 50);

    // Direct INSERT to Supabase messages table with validated UUIDs
    const newMsg = {
      sender_id: senderUuid,
      receiver_id: targetPartnerUuid,
      text: messageText,
      is_read: false
    };

    console.log("Message sent to Supabase:", newMsg);

    try {
      const { error } = await supabase
        .from('messages')
        .insert([newMsg]);

      if (error) {
        console.error("Error sending message to Supabase:", error);
      }

      // Refresh conversations from Supabase
      await syncAllConversationsFromSupabase();
    } catch (err) {
      console.error("Error sending message to Supabase:", err);
    }
  };

  const handleDeleteConversation = (convId: string) => {
    const updated = conversations.filter(c => c.id !== convId);
    setConversations(updated);
    localStorage.setItem('tutor_conversations', JSON.stringify(updated));

    if (activeConvId === convId) {
      setActiveConvId(null);
    }
    setDeleteConfirmId(null);
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeOpponentName = activeConv ? getOpponentName(activeConv) : '';

  // Find the tutor associated with active conversation
  const activeTutor = activeConv
    ? tutors.find(t => t.id === activeConv.tutorId || t.id === activeConv.id || (activeConv.tutorEmail && t.email?.toLowerCase() === activeConv.tutorEmail?.toLowerCase())) ||
      (initialTutorToChat && (initialTutorToChat.id === activeConv.tutorId || initialTutorToChat.id === activeConv.id) ? initialTutorToChat : null)
    : null;

  const handleBookLessonInChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    if (!activeTutor || !selectedSlot || !activeConvId || isSubmittingBooking) {
      if (!selectedSlot) setBookingError('אנא בחר שעה פנויה מהרשימה');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const studentDisplayName = currentUser.name?.trim() || 'תלמיד';
      const studentEmail = currentUser.email?.trim() || '';

      if (onBookLesson) {
        onBookLesson(activeTutor.id, selectedSlot, studentDisplayName, studentEmail, bookingNote);
      }

      // Auto-send single automated booking notification message into chat with clear student name
      const bookingMsgText = `📅 *תואם שיעור חדש!*
👤 תלמיד: ${studentDisplayName}
📧 אימייל: ${studentEmail}
📌 מועד: ${selectedSlot.day}, שעה ${selectedSlot.time}
💰 עלות: ₪${activeTutor.price} / שעה
${bookingNote.trim() ? `📝 נושא השיעור / הערה: ${bookingNote.trim()}\n` : ''}
ההזמנה נקלטה במערכת בהצלחה וממתינה לקיום השיעור!`;

      let senderUuid = myUuid;
      if (!senderUuid || !isValidUuid(senderUuid)) {
        senderUuid = await resolveUserUuid(currentUser);
        if (senderUuid) setMyUuid(senderUuid);
      }

      const msgId = `msg-${Date.now()}`;
      const timestamp = new Date().toISOString();

      const newMessage: ChatMessage = {
        id: msgId,
        senderId: senderUuid || currentUser.email,
        senderName: studentDisplayName,
        text: bookingMsgText,
        timestamp
      };

      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id === activeConvId) {
            return {
              ...c,
              messages: [...c.messages, newMessage],
              lastMessageAt: timestamp
            };
          }
          return c;
        });
        localStorage.setItem('tutor_conversations', JSON.stringify(updated));
        return updated;
      });

      setIsBookingOpen(false);
      setSelectedSlot(null);
      setBookingNote('');
      setBookingSuccessMsg(`השיעור ל${selectedSlot.day} (${selectedSlot.time}) תואם בהצלחה!`);
      setTimeout(() => setBookingSuccessMsg(''), 4000);
      setTimeout(() => scrollToBottom('smooth'), 50);

      // Save automated notification in Supabase - exactly ONE message
      if (senderUuid && isValidUuid(activeConvId)) {
        try {
          const autoMsgPayload = {
            sender_id: senderUuid,
            receiver_id: activeConvId,
            text: bookingMsgText,
            is_read: false
          };
          console.log("Message sent to Supabase:", autoMsgPayload);
          const { error } = await supabase
            .from('messages')
            .insert([autoMsgPayload]);

          if (error) {
            console.error("Error sending booking message to Supabase:", error);
          }
          await syncAllConversationsFromSupabase();
        } catch (err) {
          console.error("Error sending booking message to Supabase:", err);
        }
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to clean internal logs and metadata from message text
  const cleanMessageDisplay = (rawText?: string) => {
    if (!rawText) return '';
    return rawText
      .replace(/\[STATUS_UPDATE:[^\]]+\]/g, '')
      .replace(/\[REVIEW_LOG:[^\]]+\]/g, '')
      .trim();
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-hidden"
    >
      <div 
        className="bg-white w-full max-w-4xl h-[90vh] max-h-[750px] rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-200 relative min-w-0"
        dir="rtl"
      >
        {/* ========================================================================= */}
        {/* SIDEBAR: Conversations List */}
        {/* ========================================================================= */}
        <div className={`w-full md:w-80 md:shrink-0 border-l border-slate-200 flex flex-col bg-slate-50 relative min-w-0 h-full overflow-hidden ${
          activeConvId ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-lg">שיחות והודעות</h3>
            </div>
            <button
              onClick={onClose}
              title="סגור חלונית"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="relative">
              <input
                type="text"
                placeholder="חפש שיחה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-w-0">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-sm font-medium">אין שיחות פעילות</p>
                <p className="text-xs text-slate-400 mt-1">
                  {currentUser.role === 'teacher' ? 'כשתלמידים יפנו אליך, השיחות יופיעו כאן' : 'פנה למורה דרך הכרטיס שלו להתחלת שיחה'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const opponentName = getOpponentName(conv);
                const opponentAvatar = getOpponentAvatar(conv);
                const isSelected = activeConvId === conv.id;
                const unread = conv.unreadCount?.[currentUser.email] || 0;
                const lastMsg = conv.messages[conv.messages.length - 1];
                const previewText = lastMsg ? (cleanMessageDisplay(lastMsg.text) || 'הודעה חדשה') : 'שיחה חדשה';

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setActiveConvId(conv.id);
                      markAsRead(conv.id);
                    }}
                    className={`w-full p-3 text-right flex items-center gap-3 transition-colors select-none cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/80 border-r-4 border-indigo-600' 
                        : 'hover:bg-slate-100/70 bg-white'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {renderAvatarNode(opponentAvatar, opponentName, 'w-11 h-11', 'text-base')}
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                          {unread}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className={`text-sm truncate ${unread > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                          {opponentName}
                        </h4>
                        {lastMsg && (
                          <span className="text-[11px] text-slate-400 flex-shrink-0 mr-1">
                            {formatTime(lastMsg.timestamp)}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${unread > 0 ? 'text-indigo-700 font-medium' : 'text-slate-500'}`}>
                        {previewText}
                      </p>
                    </div>

                    {/* Delete action */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(conv.id);
                      }}
                      title="מחק שיחה"
                      className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN: Chat Conversation Window */}
        {/* ========================================================================= */}
        <div className={`flex-1 min-w-0 flex flex-col bg-white relative h-full overflow-hidden ${
          !activeConvId ? 'hidden md:flex items-center justify-center bg-slate-50' : 'flex'
        }`}>
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 sm:p-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-xs z-10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveConvId(null);
                    }}
                    className="p-2 -mr-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 rounded-xl md:hidden shrink-0 transition-colors flex items-center justify-center cursor-pointer touch-manipulation"
                    title="חזרה לכל השיחות"
                    aria-label="חזרה לרשימת השיחות"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  {renderAvatarNode(getOpponentAvatar(activeConv), activeOpponentName, 'w-10 h-10', 'text-base')}
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
                      {activeOpponentName}
                    </h3>
                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0"></span>
                      <span>זמין להתכתבות בזמן אמת</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Quick Lesson Booking Button for Students */}
                  {currentUser.role === 'student' && activeTutor && (
                    <button
                      onClick={() => setIsBookingOpen(!isBookingOpen)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-200 shadow-xs cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">תאם שיעור עכשיו</span>
                      <span className="sm:hidden">תאם</span>
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="סגור חלונית"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* In-Chat Lesson Booking Panel (Dropdown drawer) */}
              {isBookingOpen && activeTutor && (
                <div className="bg-indigo-50/90 border-b border-indigo-100 p-4 transition-all animate-fade-in text-right shrink-0">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      תיאום שיעור מהיר עם {activeTutor.name} (₪{activeTutor.price}/שעה)
                    </h4>
                    <button
                      onClick={() => setIsBookingOpen(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ביטול
                    </button>
                  </div>

                  {bookingError && (
                    <div className="mb-2 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{bookingError}</span>
                    </div>
                  )}

                  <form onSubmit={handleBookLessonInChat} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        בחר שעה פנויה:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                        {activeTutor.availableSlots && activeTutor.availableSlots.filter(s => !s.isBooked).length > 0 ? (
                          activeTutor.availableSlots
                            .filter(s => !s.isBooked)
                            .map(slot => (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={`p-2 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                                  selectedSlot?.id === slot.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                                }`}
                              >
                                <div className="font-bold">{slot.day}</div>
                                <div className="text-[11px] opacity-90">{slot.time}</div>
                              </button>
                            ))
                        ) : (
                          <p className="col-span-full text-xs text-slate-500 py-2">
                            אין שעות פנויות זמינות כרגע למורה זה.
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        נושא השיעור / הערה למורה (אופציונלי):
                      </label>
                      <input
                        type="text"
                        value={bookingNote}
                        onChange={(e) => setBookingNote(e.target.value)}
                        placeholder="למשל: הכנה למבחן בגרות / עזרה בשיעורי בית"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsBookingOpen(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        סגור
                      </button>
                      <button
                        type="submit"
                        disabled={!selectedSlot || isSubmittingBooking}
                        className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSubmittingBooking ? 'מתאם שיעור...' : 'אשר תיאום שיעור'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Booking success banner */}
              {bookingSuccessMsg && (
                <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs px-4 py-2 flex items-center justify-between animate-fade-in shrink-0">
                  <span>{bookingSuccessMsg}</span>
                  <button onClick={() => setBookingSuccessMsg('')} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
                    ✕
                  </button>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {activeConv.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <Sparkles className="w-10 h-10 mb-2 text-indigo-400 opacity-60" />
                    <p className="text-sm font-medium text-slate-700">זוהי תחילת השיחה עם {activeOpponentName}</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      שלח הודעה כדי להתייעץ, לשאול שאלות על חומר הלימוד או לתאם שעה נוחה לשיעור.
                    </p>
                  </div>
                ) : (
                  activeConv.messages.map((msg) => {
                    const isMine = msg.senderId === myUuid || msg.senderId === currentUser.email || msg.senderId === currentUser.id;
                    const cleanText = cleanMessageDisplay(msg.text);
                    if (!cleanText) return null;

                    const isApprovedNotice = msg.text && (msg.text.includes('השיעור אושר') || msg.text.includes('STATUS_UPDATE:APPROVED'));

                    const senderAvatar = isMine
                      ? (currentUser.avatarUrl || getUserAvatar(currentUser.id))
                      : (getUserAvatar(msg.senderId) || getOpponentAvatar(activeConv));
                    const senderDisplayName = isMine ? (currentUser.name || 'אני') : (activeOpponentName || 'משתמש');

                    // Find corresponding booking if any
                    const matchedBooking = isApprovedNotice ? bookings.find(b => 
                      b.status === 'מאושר' && (
                        b.tutorId === activeConv.tutorId || 
                        b.tutorEmail === activeConv.tutorEmail ||
                        b.studentEmail === activeConv.studentEmail ||
                        (b as any).studentId === activeConv.id ||
                        b.tutorId === activeConv.id
                      )
                    ) : null;

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} max-w-full`}
                      >
                        <div className="shrink-0 mb-4">
                          {renderAvatarNode(senderAvatar, senderDisplayName, 'w-7 h-7', 'text-[11px]')}
                        </div>
                        <div
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[78%] min-w-0`}
                        >
                          <div
                            className={`px-4 py-2.5 rounded-2xl shadow-xs text-sm whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] ${
                              isMine
                                ? 'bg-indigo-600 text-white rounded-br-xs'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                            }`}
                          >
                            <div className="break-words [overflow-wrap:anywhere]">{cleanText}</div>

                            {isApprovedNotice && (
                              <div className="mt-2.5 pt-2 border-t border-indigo-400/30 flex flex-col gap-2">
                                {matchedBooking && onStartLiveLesson ? (
                                  <button
                                    type="button"
                                    onClick={() => onStartLiveLesson(matchedBooking)}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>היכנס לשיעור וידאו</span>
                                  </button>
                                ) : onOpenMyBookings ? (
                                  <button
                                    type="button"
                                    onClick={onOpenMyBookings}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                  >
                                    <Video className="w-3.5 h-3.5" />
                                    <span>צפה בשיעור המאושר</span>
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 px-1">
                            <span>{formatTime(msg.timestamp)}</span>
                            {isMine && <CheckCheck className="w-3 h-3 text-indigo-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`הקלד הודעה ל${activeOpponentName}...`}
                    className="flex-1 min-w-0 px-4 py-2.5 bg-slate-100 hover:bg-slate-50 focus:bg-white text-sm text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="shrink-0 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                    title="שלח הודעה"
                  >
                    <Send className="w-4 h-4 transform rotate-180" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-8 text-slate-400">
              <button
                onClick={onClose}
                title="סגור חלונית"
                className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-20 text-slate-500" />
                <h4 className="text-base font-bold text-slate-700 mb-1">בחר שיחה מהרשימה</h4>
                <p className="text-xs text-slate-400">
                  לחץ על שיחה מצד ימין כדי לצפות בהודעות ולהמשיך בהתכתבות.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full text-right shadow-xl">
            <h4 className="font-bold text-slate-900 text-base mb-2">מחיקת שיחה</h4>
            <p className="text-xs text-slate-600 mb-4">
              האם אתה בטוח שברצונך למחוק את השיחה? פעולה זו תסיר את היסטוריית ההודעות מהתצוגה שלך.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              >
                ביטול
              </button>
              <button
                onClick={() => handleDeleteConversation(deleteConfirmId)}
                className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-semibold shadow-sm"
              >
                מחק שיחה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

