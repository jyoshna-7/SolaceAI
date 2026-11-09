import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar, TouchableOpacity,
  TextInput, Platform, ActivityIndicator, Alert, useWindowDimensions,
  KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const API_URL = 'http://192.168.1.24:5000/chat';

const KEYS = {
  journal: '@solace_journal_entries',
  mood: '@solace_mood_history',
  chat: '@solace_chat_history',
  reminder: '@solace_reminder_notification_id',
  webReminder: '@solace_web_reminder',
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const C = {
  bg: '#F5F7F2',
  white: '#FFFFFF',
  ink: '#20382F',
  muted: '#77877E',
  green: '#527D68',
  dark: '#315B47',
  mint: '#E5F0E7',
  line: '#E7ECE5',
  yellow: '#F8EBCB',
  peach: '#F8E3DD',
  lavender: '#ECE8F6',
  blue: '#E5EDF7',
};

const MOODS = [
  { emoji: '😊', label: 'Happy', color: C.yellow, note: 'Keep that light with you.' },
  { emoji: '😌', label: 'Calm', color: C.mint, note: 'Enjoy this peaceful moment.' },
  { emoji: '😔', label: 'Sad', color: C.lavender, note: 'It is okay not to be okay.' },
  { emoji: '😰', label: 'Anxious', color: C.peach, note: 'One breath at a time.' },
  { emoji: '😴', label: 'Tired', color: C.blue, note: 'Rest is productive too.' },
];

const PHASES = [
  { name: 'Inhale', instruction: 'Breathe in slowly', emoji: '🌿' },
  { name: 'Hold', instruction: 'Gently hold your breath', emoji: '🍃' },
  { name: 'Exhale', instruction: 'Breathe out slowly', emoji: '🌬️' },
  { name: 'Hold', instruction: 'Rest before the next breath', emoji: '💚' },
];

const NAV = [
  { id: 'home', icon: '⌂', label: 'Home' },
  { id: 'chat', icon: '✧', label: 'AI Chat' },
  { id: 'breathing', icon: '◉', label: 'Breathe' },
  { id: 'journal', icon: '▤', label: 'Journal' },
  { id: 'moodHistory', icon: '▥', label: 'History' },
];

const showMessage = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

function App() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isSmall = width < 600;

  const [screen, setScreen] = useState('home');
  const [mood, setMood] = useState('');
  const [moodHistory, setMoodHistory] = useState([]);
  const [moodLoading, setMoodLoading] = useState(true);

  const [journalText, setJournalText] = useState('');
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(true);
  const [savingJournal, setSavingJournal] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      text: "Hi! I'm Solace, your wellness companion. 💚 What's on your mind today?",
      sender: 'ai',
    },
  ]);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [seconds, setSeconds] = useState(4);
  const [isRunning, setIsRunning] = useState(false);
  const [cycles, setCycles] = useState(0);

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const webReminderTimer = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedChat = await AsyncStorage.getItem(KEYS.chat);
        if (savedChat) {
          const parsed = JSON.parse(savedChat);
          if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
        }
      } catch (e) {
        console.log('Chat history loading error:', e);
      } finally {
        setChatHistoryLoaded(true);
      }

      try {
        const savedJournal = await AsyncStorage.getItem(KEYS.journal);
        if (savedJournal) setJournalEntries(JSON.parse(savedJournal));
      } catch (e) {
        console.log('Journal loading error:', e);
      } finally {
        setJournalLoading(false);
      }

      try {
        const savedMood = await AsyncStorage.getItem(KEYS.mood);
        if (savedMood) {
          const parsed = JSON.parse(savedMood);
          setMoodHistory(parsed);
          if (parsed.length) setMood(parsed[0].label);
        }
      } catch (e) {
        console.log('Mood loading error:', e);
      } finally {
        setMoodLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (chatHistoryLoaded) {
      AsyncStorage.setItem(KEYS.chat, JSON.stringify(messages))
        .catch(e => console.log('Chat save error:', e));
    }
  }, [messages, chatHistoryLoaded]);

  const scheduleWebReminder = () => {
    if (
      Platform.OS !== 'web' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) return;

    if (webReminderTimer.current) clearTimeout(webReminderTimer.current);
    if (localStorage.getItem(KEYS.webReminder) !== 'enabled') return;

    const next = new Date();
    next.setHours(20, 0, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);

    webReminderTimer.current = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('A little moment for yourself 💚', {
          body: 'Take a deep breath and be kind to yourself.',
        });
      }
      scheduleWebReminder();
    }, next.getTime() - Date.now());
  };

  useEffect(() => {
    const checkReminder = async () => {
      if (Platform.OS === 'web') {
        const enabled = localStorage.getItem(KEYS.webReminder) === 'enabled';
        setReminderEnabled(enabled);
        if (enabled) scheduleWebReminder();
        return;
      }

      try {
        const id = await AsyncStorage.getItem(KEYS.reminder);
        const all = await Notifications.getAllScheduledNotificationsAsync();
        setReminderEnabled(!!id && all.some(x => x.identifier === id));
      } catch (e) {
        console.log('Reminder check error:', e);
      }
    };

    checkReminder();

    return () => {
      if (webReminderTimer.current) clearTimeout(webReminderTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setSeconds(current => {
        if (current > 1) return current - 1;

        setPhaseIndex(previous => {
          const next = (previous + 1) % 4;
          if (previous === 3) setCycles(value => value + 1);
          return next;
        });

        return 4;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const selectMood = async label => {
    const item = MOODS.find(x => x.label === label);
    if (!item) return;

    const entry = {
      id: Date.now().toString(),
      label,
      emoji: item.emoji,
      date: new Date().toISOString(),
    };

    const updated = [entry, ...moodHistory];

    try {
      await AsyncStorage.setItem(KEYS.mood, JSON.stringify(updated));
      setMood(label);
      setMoodHistory(updated);
    } catch (e) {
      showMessage('Error', 'Unable to save your mood.');
    }
  };

  // Android local notification fix: no custom channel or channelId.
  const enableReminder = async () => {
    if (reminderLoading) return;
    setReminderLoading(true);

    try {
      // Web notification flow remains unchanged.
      if (Platform.OS === 'web') {
        if (!('Notification' in window)) {
          showMessage('Not supported', 'This browser does not support notifications.');
          return;
        }

        let permission = Notification.permission;
        if (permission !== 'granted') {
          permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
          showMessage('Permission required', 'Allow notifications in browser settings.');
          return;
        }

        localStorage.setItem(KEYS.webReminder, 'enabled');
        setReminderEnabled(true);
        scheduleWebReminder();

        showMessage(
          'Reminder enabled 💚',
          'Your 8:00 PM reminder is enabled. Keep this browser tab open.'
        );
        return;
      }

      // Request notification permission on the device.
      let permission = await Notifications.getPermissionsAsync();

      if (!permission.granted) {
        permission = await Notifications.requestPermissionsAsync();
      }

      if (!permission.granted) {
        showMessage(
          'Permission required',
          permission.canAskAgain
            ? 'Please allow notifications when your phone asks.'
            : 'Please enable notifications for SolaceAI in your phone Settings.'
        );
        return;
      }

      // Cancel the previous reminder before creating a new one.
      const oldId = await AsyncStorage.getItem(KEYS.reminder);

      if (oldId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(oldId);
        } catch (cancelError) {
          console.log('Old reminder cancellation:', cancelError);
        }
      }

      // Schedule a daily local notification for 8:00 PM.
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'A little moment for yourself 💚',
          body: 'Take a deep breath and be kind to yourself.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
        },
      });

      await AsyncStorage.setItem(KEYS.reminder, id);
      setReminderEnabled(true);

      showMessage(
        'Reminder enabled 💚',
        'Solace will remind you every day at 8:00 PM.'
      );
    } catch (e) {
      console.log('Reminder scheduling error:', e);
      showMessage('Reminder error', e?.message || 'Unable to schedule reminder.');
    } finally {
      setReminderLoading(false);
    }
  };

  const disableReminder = async () => {
    if (reminderLoading) return;
    setReminderLoading(true);

    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(KEYS.webReminder);
        if (webReminderTimer.current) clearTimeout(webReminderTimer.current);
      } else {
        const id = await AsyncStorage.getItem(KEYS.reminder);
        if (id) await Notifications.cancelScheduledNotificationAsync(id);
        await AsyncStorage.removeItem(KEYS.reminder);
      }

      setReminderEnabled(false);
      showMessage('Reminder turned off', 'Your daily reminder has been cancelled.');
    } catch (e) {
      showMessage('Error', 'Unable to turn off the reminder.');
    } finally {
      setReminderLoading(false);
    }
  };

  const saveJournal = async () => {
    const text = journalText.trim();

    if (!text) {
      showMessage('Empty Journal', 'Please write something before saving.');
      return;
    }

    if (savingJournal) return;

    const updated = [
      { id: Date.now().toString(), text, date: new Date().toISOString() },
      ...journalEntries,
    ];

    try {
      setSavingJournal(true);
      await AsyncStorage.setItem(KEYS.journal, JSON.stringify(updated));
      setJournalEntries(updated);
      setJournalText('');
      showMessage('Saved successfully 💚', 'Your journal entry has been saved.');
    } catch (e) {
      showMessage('Error', 'Unable to save your journal entry.');
    } finally {
      setSavingJournal(false);
    }
  };

  const deleteJournal = id => {
    const removeEntry = async () => {
      const updated = journalEntries.filter(x => x.id !== id);

      try {
        await AsyncStorage.setItem(KEYS.journal, JSON.stringify(updated));
        setJournalEntries(updated);
      } catch (e) {
        showMessage('Error', 'Unable to delete this entry.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this journal entry?')) removeEntry();
    } else {
      Alert.alert('Delete Journal Entry', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: removeEntry },
      ]);
    }
  };

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || loading || !chatHistoryLoaded) return;

    setMessages(previous => [
      ...previous,
      { id: Date.now().toString(), text, sender: 'user' },
    ]);
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to get an AI response.');
      }

      setMessages(previous => [
        ...previous,
        {
          id: (Date.now() + 1).toString(),
          text: data.reply || 'I am here to listen. Could you tell me more?',
          sender: 'ai',
        },
      ]);
    } catch (e) {
      console.log('Chat API error:', e.message);

      setMessages(previous => [
        ...previous,
        {
          id: (Date.now() + 1).toString(),
          text: 'I could not connect right now. Please check your connection and try again. 💚',
          sender: 'ai',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const go = id => {
    setIsRunning(false);
    setScreen(id);
  };

  const resetBreathing = () => {
    setIsRunning(false);
    setPhaseIndex(0);
    setSeconds(4);
    setCycles(0);
  };

  const currentMood = MOODS.find(x => x.label === mood);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const Header = ({ title, subtitle }) => (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pageEyebrow}>
          SOLACE AI  /  {screen === 'home' ? 'OVERVIEW' : title.toUpperCase()}
        </Text>
        <Text style={[styles.pageTitle, isSmall && { fontSize: 25 }]}>{title}</Text>
        <Text style={styles.pageSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headerAvatar}>
        <Text style={{ fontSize: 25 }}>🌿</Text>
      </View>
    </View>
  );

  const CardTitle = ({ eyebrow, title, right }) => (
    <View style={styles.cardTitleRow}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.cardEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {right || null}
    </View>
  );

  const Sidebar = () => (
    <View style={styles.sidebar}>
      <View style={styles.logoRow}>
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>✦</Text>
        </View>
        <View>
          <Text style={styles.logo}>SOLACE AI</Text>
          <Text style={styles.logoSub}>YOUR WELLNESS SPACE</Text>
        </View>
      </View>

      <Text style={styles.navCaption}>MENU</Text>

      {NAV.map(item => (
        <TouchableOpacity
          key={item.id}
          onPress={() => go(item.id)}
          style={[styles.navItem, screen === item.id && styles.navItemActive]}
        >
          <Text style={[styles.navIcon, screen === item.id && styles.navIconActive]}>
            {item.icon}
          </Text>
          <Text style={[styles.navLabel, screen === item.id && styles.navLabelActive]}>
            {item.label}
          </Text>
          {screen === item.id ? <View style={styles.navDot} /> : null}
        </TouchableOpacity>
      ))}

      <View style={styles.sidebarBottom}>
        <View style={styles.sidebarQuote}>
          <Text style={styles.sidebarQuoteIcon}>☁</Text>
          <Text style={styles.sidebarQuoteTitle}>A gentle reminder</Text>
          <Text style={styles.sidebarQuoteText}>
            You deserve the same kindness you give to others.
          </Text>
        </View>
        <Text style={styles.sidebarFooter}>Made with care ♡</Text>
      </View>
    </View>
  );

  const Home = () => (
    <>
      <Header
        title="Hello, there 👋"
        subtitle={`${today}  ·  Take a moment for yourself.`}
      />

      <View style={[styles.heroCard, isSmall && styles.heroCardMobile]}>
        <View style={styles.heroTextWrap}>
          <View style={styles.heroPill}>
            <View style={styles.heroPillDot} />
            <Text style={styles.heroPillText}>A LITTLE SPACE JUST FOR YOU</Text>
          </View>

          <Text style={[styles.heroTitle, isSmall && { fontSize: 24, lineHeight: 31 }]}>
            Your mind deserves{' '}
            {'\n'}a moment of <Text style={styles.heroAccent}>peace.</Text>
          </Text>

          <Text style={styles.heroDescription}>
            Pause, check in with yourself, and take one small step toward feeling better.
          </Text>

          <TouchableOpacity style={styles.heroButton} onPress={() => go('breathing')}>
            <Text style={styles.heroButtonText}>Start a mindful moment  →</Text>
          </TouchableOpacity>
        </View>

        {!isSmall ? (
          <View style={styles.heroArt}>
            <View style={styles.heroOrb}>
              <Text style={styles.heroPlant}>🌱</Text>
            </View>
            <Text style={styles.heroSparkleOne}>✦</Text>
            <Text style={styles.heroSparkleTwo}>✧</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>♡</Text>
          <Text style={styles.statNumber}>{moodHistory.length}</Text>
          <Text style={styles.statLabel}>Mood check-ins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>▤</Text>
          <Text style={styles.statNumber}>{journalEntries.length}</Text>
          <Text style={styles.statLabel}>Journal entries</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>◉</Text>
          <Text style={styles.statNumber}>{cycles}</Text>
          <Text style={styles.statLabel}>Breathing cycles</Text>
        </View>
      </View>

      <View style={[styles.contentGrid, !isWide && styles.contentGridMobile]}>
        <View style={styles.mainColumn}>
          <View style={styles.panel}>
            <CardTitle
              eyebrow="DAILY CHECK-IN"
              title="How are you feeling today?"
              right={<Text style={styles.softIcon}>✧</Text>}
            />
            <Text style={styles.panelSub}>
              There is no right or wrong answer. Just check in with yourself.
            </Text>

            <View style={styles.moodGrid}>
              {MOODS.map(item => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => selectMood(item.label)}
                  style={[
                    styles.moodTile,
                    { backgroundColor: item.color },
                    mood === item.label && styles.moodTileSelected,
                  ]}
                >
                  <Text style={styles.moodTileEmoji}>{item.emoji}</Text>
                  <Text style={styles.moodTileLabel}>{item.label}</Text>
                  {mood === item.label ? <Text style={styles.moodCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </View>

            {currentMood ? (
              <View style={styles.moodFeedback}>
                <Text style={styles.moodFeedbackText}>
                  {currentMood.emoji}  {currentMood.note}
                </Text>
                <TouchableOpacity onPress={() => go('moodHistory')}>
                  <Text style={styles.inlineLink}>View history →</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.panel}>
            <CardTitle
              eyebrow="YOUR WELLNESS SPACE"
              title="Small steps, meaningful care"
            />

            <View style={styles.featureGrid}>
              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#E8F1E9' }]}
                onPress={() => go('breathing')}
              >
                <View style={styles.featureIcon}><Text>🌬️</Text></View>
                <Text style={styles.featureTitle}>Mindful breathing</Text>
                <Text style={styles.featureDesc}>
                  Slow down with a calming 4-step breathing exercise.
                </Text>
                <Text style={styles.featureLink}>Begin exercise  ↗</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#F0ECF8' }]}
                onPress={() => go('chat')}
              >
                <View style={[styles.featureIcon, { backgroundColor: '#E4DDF2' }]}>
                  <Text>💬</Text>
                </View>
                <Text style={styles.featureTitle}>AI companion</Text>
                <Text style={styles.featureDesc}>
                  A thoughtful space to share what is on your mind.
                </Text>
                <Text style={styles.featureLink}>Start a conversation  ↗</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#FBF0DD' }]}
                onPress={() => go('journal')}
              >
                <View style={[styles.featureIcon, { backgroundColor: '#F5E5C6' }]}>
                  <Text>📖</Text>
                </View>
                <Text style={styles.featureTitle}>Daily journal</Text>
                <Text style={styles.featureDesc}>
                  Put your thoughts into words and reflect on your day.
                </Text>
                <Text style={styles.featureLink}>Write an entry  ↗</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.sideColumn}>
          <View style={styles.reminderPanel}>
            <View style={styles.reminderTop}>
              <Text style={styles.reminderIcon}>🔔</Text>
              <View style={styles.reminderStatus}>
                <View style={[styles.statusDot, reminderEnabled && styles.statusDotOn]} />
                <Text style={styles.statusText}>
                  {reminderEnabled ? 'ACTIVE' : 'DAILY WELLNESS'}
                </Text>
              </View>
            </View>

            <Text style={styles.reminderHeading}>Make time for yourself.</Text>
            <Text style={styles.reminderCopy}>
              A gentle nudge to pause, breathe, and reconnect with how you feel.
            </Text>

            <View style={styles.reminderTime}>
              <Text style={styles.clockIcon}>◷</Text>
              <Text style={styles.reminderTimeText}>Every day at 8:00 PM</Text>
            </View>

            <TouchableOpacity
              style={styles.reminderAction}
              onPress={reminderEnabled ? disableReminder : enableReminder}
              disabled={reminderLoading}
            >
              {reminderLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.reminderActionText}>
                  {reminderEnabled ? 'Turn reminder off' : 'Set daily reminder  →'}
                </Text>
              )}
            </TouchableOpacity>

            {Platform.OS === 'web' ? (
              <Text style={styles.browserNote}>
                Keep this browser tab open for the reminder.
              </Text>
            ) : null}
          </View>

          <View style={styles.quotePanel}>
            <Text style={styles.quoteMark}>“</Text>
            <Text style={styles.quoteText}>
              You don't have to be perfect. You just have to be you.
            </Text>
            <View style={styles.quoteDivider} />
            <Text style={styles.quoteBy}>A LITTLE KINDNESS GOES A LONG WAY  ♡</Text>
          </View>

          <TouchableOpacity
            style={styles.historyLinkCard}
            onPress={() => go('moodHistory')}
          >
            <View style={styles.historyIcon}><Text>▥</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>Your mood history</Text>
              <Text style={styles.historySub}>Look back at your journey</Text>
            </View>
            <Text style={styles.historyArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>Made with care for your mind and soul  ♡</Text>
    </>
  );

  const Chat = () => (
    <>
      <Header
        title="AI Companion"
        subtitle="A safe space for your thoughts and feelings."
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.chatPanel}
      >
        <View style={styles.chatPanelHeader}>
          <View style={styles.chatAvatar}>
            <Text style={styles.chatAvatarText}>✧</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chatPanelTitle}>Solace Companion</Text>
            <Text style={styles.chatPanelSub}>
              ●  {loading ? 'Thinking...' : 'Here to listen'}
            </Text>
          </View>
          <Text style={styles.privateLabel}>PRIVATE SPACE</Text>
        </View>

        <ScrollView
          style={styles.chatArea}
          contentContainerStyle={styles.chatMessages}
          keyboardShouldPersistTaps="handled"
        >
          {!chatHistoryLoaded ? (
            <ActivityIndicator color={C.green} />
          ) : (
            messages.map(item => (
              <View
                key={item.id}
                style={[
                  styles.messageBubble,
                  item.sender === 'user' ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    item.sender === 'user' && styles.userMessageText,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            ))
          )}

          {loading ? (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <ActivityIndicator color={C.green} />
              <Text style={styles.typingText}>Solace is thinking...</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            placeholder="Share what's on your mind..."
            placeholderTextColor="#98A39B"
            value={message}
            onChangeText={setMessage}
            multiline
            editable={!loading && chatHistoryLoaded}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || loading) && { opacity: 0.45 },
            ]}
            onPress={sendMessage}
            disabled={!message.trim() || loading}
          >
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.chatDisclaimer}>
          Solace is a supportive companion, not a replacement for professional mental-health care.
        </Text>
      </KeyboardAvoidingView>
    </>
  );

  const Breathing = () => {
    const phase = PHASES[phaseIndex];

    return (
      <>
        <Header
          title="Mindful Breathing"
          subtitle="Create a little space. Find your calm."
        />

        <View style={styles.breathPanel}>
          <Text style={styles.cardEyebrow}>BOX BREATHING · 4 × 4</Text>
          <Text style={styles.breathTitle}>Come back to the present.</Text>
          <Text style={styles.breathIntro}>
            Follow the gentle rhythm. Breathe comfortably and never force your breath.
          </Text>

          <View style={styles.breathVisual}>
            <View style={[styles.breathRing, isRunning && styles.breathRingActive]}>
              <View style={styles.breathInner}>
                <Text style={styles.breathEmoji}>{phase.emoji}</Text>
                <Text style={styles.breathPhase}>{phase.name}</Text>
                <Text style={styles.breathSeconds}>
                  {seconds}<Text style={styles.secondsUnit}> sec</Text>
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.breathInstruction}>
            {isRunning ? phase.instruction : 'Press start whenever you are ready.'}
          </Text>

          <Text style={styles.cycleCount}>COMPLETED CYCLES  ·  {cycles}</Text>

          <View style={[styles.phaseGuide, isSmall && { flexWrap: 'wrap' }]}>
            {PHASES.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                style={[
                  styles.phaseItem,
                  isSmall && { minWidth: '45%' },
                  phaseIndex === index && isRunning && styles.phaseItemActive,
                ]}
              >
                <Text style={styles.phaseNumber}>0{index + 1}</Text>
                <Text style={styles.phaseItemName}>{item.name}</Text>
                <Text style={styles.phaseItemTime}>4 seconds</Text>
              </View>
            ))}
          </View>

          <View style={styles.breathButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setIsRunning(!isRunning)}
            >
              <Text style={styles.primaryButtonText}>
                {isRunning
                  ? 'Ⅱ  Pause session'
                  : seconds === 4 && phaseIndex === 0 && cycles === 0
                    ? '▶  Start breathing'
                    : '▶  Resume session'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={resetBreathing}>
              <Text style={styles.secondaryButtonText}>↻ Reset</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.breathFoot}>
            Go at your own pace. You can stop whenever you need. 💚
          </Text>
        </View>
      </>
    );
  };

  const Journal = () => (
    <>
      <Header
        title="My Journal"
        subtitle="A private space to reflect, release, and grow."
      />

      <View style={styles.journalLayout}>
        <View style={styles.journalCompose}>
          <Text style={styles.cardEyebrow}>DAILY REFLECTION</Text>
          <Text style={styles.journalPrompt}>What's on your mind today?</Text>
          <Text style={styles.journalHint}>
            There is no perfect way to journal. Just start where you are.
          </Text>

          <TextInput
            style={styles.journalInput}
            placeholder={'Today I am feeling...\n\nSomething I am grateful for...'}
            placeholderTextColor="#A0AAA2"
            value={journalText}
            onChangeText={setJournalText}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.journalComposeBottom}>
            <Text style={styles.privateNote}>🔒 Saved privately on this device</Text>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.saveButton,
                (!journalText.trim() || savingJournal) && { opacity: 0.5 },
              ]}
              onPress={saveJournal}
              disabled={!journalText.trim() || savingJournal}
            >
              {savingJournal ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save my reflection  →</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.entriesSection}>
          <View style={styles.entriesHeader}>
            <Text style={styles.cardTitle}>Previous entries</Text>
            <Text style={styles.entryCount}>{journalEntries.length} SAVED</Text>
          </View>

          {journalLoading ? (
            <ActivityIndicator color={C.green} />
          ) : journalEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>Your story starts here</Text>
              <Text style={styles.emptyText}>
                Your saved reflections will appear here.
              </Text>
            </View>
          ) : (
            journalEntries.map(entry => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryTop}>
                  <Text style={styles.entryDate}>
                    {new Date(entry.date).toLocaleString()}
                  </Text>
                  <TouchableOpacity onPress={() => deleteJournal(entry.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.entryText}>{entry.text}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </>
  );

  const MoodHistory = () => (
    <>
      <Header
        title="Mood History"
        subtitle="Notice your patterns, one check-in at a time."
      />

      <View style={styles.historySummary}>
        <View>
          <Text style={styles.cardEyebrow}>YOUR JOURNEY SO FAR</Text>
          <Text style={styles.summaryNumber}>{moodHistory.length}</Text>
          <Text style={styles.summaryLabel}>Mood check-ins saved</Text>
        </View>
        <Text style={styles.summaryEmoji}>🌿</Text>
      </View>

      <View style={styles.historyListPanel}>
        <CardTitle
          title="Previous check-ins"
          right={<Text style={styles.entryCount}>YOUR RECORD</Text>}
        />

        {moodLoading ? (
          <ActivityIndicator color={C.green} />
        ) : moodHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No check-ins yet</Text>
            <Text style={styles.emptyText}>
              Choose a mood on your overview to begin tracking.
            </Text>
          </View>
        ) : (
          moodHistory.map(item => (
            <View key={item.id} style={styles.moodHistoryItem}>
              <View style={styles.moodHistoryIcon}>
                <Text style={{ fontSize: 23 }}>{item.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.moodHistoryLabel}>{item.label}</Text>
                <Text style={styles.moodHistoryDate}>
                  {new Date(item.date).toLocaleString()}
                </Text>
              </View>
              <Text style={styles.moodHistoryChevron}>›</Text>
            </View>
          ))
        )}
      </View>
    </>
  );

  // Render screen content directly to keep TextInput focus stable.
  const content =
    screen === 'home' ? Home() :
    screen === 'chat' ? Chat() :
    screen === 'breathing' ? Breathing() :
    screen === 'journal' ? Journal() :
    MoodHistory();

  return (
    <View style={styles.appRoot}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {isWide ? <Sidebar /> : null}

      <View style={styles.mainArea}>
        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={[
            styles.pageContent,
            !isWide && { padding: isSmall ? 15 : 22 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>

        {!isWide ? (
          <View style={styles.bottomNav}>
            {NAV.map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => go(item.id)}
                style={styles.bottomNavItem}
              >
                <Text
                  style={[
                    styles.bottomNavIcon,
                    screen === item.id && styles.bottomNavActive,
                  ]}
                >
                  {item.icon}
                </Text>
                <Text
                  style={[
                    styles.bottomNavLabel,
                    screen === item.id && styles.bottomNavActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  sidebar: {
    width: 235, backgroundColor: '#FBFCF9', borderRightWidth: 1,
    borderRightColor: C.line, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 50 },
  logoMark: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: C.dark,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  logoMarkText: { color: '#FFF', fontSize: 20 },
  logo: { color: C.ink, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  logoSub: { color: C.muted, fontSize: 7, letterSpacing: 1.3, marginTop: 4 },
  navCaption: {
    color: '#A1ACA3', fontSize: 9, fontWeight: '900', letterSpacing: 1.6,
    marginBottom: 12, marginLeft: 10,
  },
  navItem: {
    height: 45, borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, marginBottom: 6,
  },
  navItemActive: { backgroundColor: '#E8F1E9' },
  navIcon: { width: 27, color: '#9AA69D', fontSize: 19 },
  navIconActive: { color: C.dark },
  navLabel: { color: '#829087', fontSize: 11, fontWeight: '700', flex: 1 },
  navLabelActive: { color: C.dark, fontWeight: '900' },
  navDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green },
  sidebarBottom: { marginTop: 'auto' },
  sidebarQuote: { backgroundColor: '#F0F4ED', borderRadius: 15, padding: 14 },
  sidebarQuoteIcon: { color: C.green, fontSize: 20 },
  sidebarQuoteTitle: { color: C.ink, fontSize: 11, fontWeight: '900', marginTop: 8 },
  sidebarQuoteText: { color: C.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
  sidebarFooter: { color: '#A2ADA4', fontSize: 9, textAlign: 'center', marginTop: 18 },
  mainArea: { flex: 1, minWidth: 0 },
  pageScroll: { flex: 1 },
  pageContent: {
    padding: 28, paddingBottom: 35, width: '100%', maxWidth: 1440, alignSelf: 'center',
  },
  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 23,
  },
  pageEyebrow: {
    color: C.green, fontSize: 8, fontWeight: '900', letterSpacing: 1.8,
  },
  pageTitle: { color: C.ink, fontSize: 29, fontWeight: '900', marginTop: 9 },
  pageSubtitle: { color: C.muted, fontSize: 11, marginTop: 6 },
  headerAvatar: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: '#E5F0E7',
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  heroCard: {
    backgroundColor: '#DDEBE0', borderRadius: 22, padding: 27,
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden', minHeight: 225,
  },
  heroCardMobile: { padding: 20, minHeight: 0 },
  heroTextWrap: { flex: 1, zIndex: 1 },
  heroPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDF5EC', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7,
  },
  heroPillDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#5C9A70', marginRight: 7,
  },
  heroPillText: { color: C.dark, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  heroTitle: {
    color: C.ink, fontSize: 29, lineHeight: 36, fontWeight: '900', marginTop: 15,
  },
  heroAccent: { color: C.green },
  heroDescription: {
    color: '#60766A', fontSize: 11, lineHeight: 18, maxWidth: 420, marginTop: 9,
  },
  heroButton: {
    alignSelf: 'flex-start', backgroundColor: C.dark, paddingHorizontal: 17,
    paddingVertical: 12, borderRadius: 11, marginTop: 17,
  },
  heroButtonText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  heroArt: { width: 190, height: 170, alignItems: 'center', justifyContent: 'center' },
  heroOrb: {
    width: 135, height: 135, borderRadius: 68, backgroundColor: '#C5DDC9',
    alignItems: 'center', justifyContent: 'center', borderWidth: 9, borderColor: '#E9F2E8',
  },
  heroPlant: { fontSize: 66 },
  heroSparkleOne: {
    position: 'absolute', top: 12, right: 20, color: '#83A78B', fontSize: 23,
  },
  heroSparkleTwo: {
    position: 'absolute', bottom: 17, left: 13, color: '#83A78B', fontSize: 19,
  },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 17 },
  statCard: {
    flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.line,
    borderRadius: 15, padding: 14, minHeight: 88,
  },
  statIcon: { color: C.green, fontSize: 16 },
  statNumber: { color: C.ink, fontSize: 21, fontWeight: '900', marginTop: 4 },
  statLabel: { color: C.muted, fontSize: 9, marginTop: 2 },
  contentGrid: {
    flexDirection: 'row', gap: 17, marginTop: 18, alignItems: 'flex-start',
  },
  contentGridMobile: { flexDirection: 'column' },
  mainColumn: { flex: 1.7, minWidth: 0, width: '100%' },
  sideColumn: { flex: 1, minWidth: 0, width: '100%' },
  panel: {
    backgroundColor: C.white, borderRadius: 19, borderWidth: 1,
    borderColor: C.line, padding: 20, marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cardEyebrow: { color: C.green, fontSize: 8, letterSpacing: 1.5, fontWeight: '900' },
  cardTitle: { color: C.ink, fontSize: 16, fontWeight: '900', marginTop: 5 },
  softIcon: { color: '#8BA995', fontSize: 24 },
  panelSub: { color: C.muted, fontSize: 10, marginTop: 7 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 },
  moodTile: {
    flex: 1, minWidth: 75, minHeight: 91, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
    borderColor: 'transparent', position: 'relative', padding: 9,
  },
  moodTileSelected: { borderColor: C.dark, transform: [{ scale: 1.025 }] },
  moodTileEmoji: { fontSize: 26 },
  moodTileLabel: { color: C.ink, fontSize: 10, fontWeight: '900', marginTop: 7 },
  moodCheck: {
    position: 'absolute', top: 5, right: 8, color: C.dark, fontSize: 12, fontWeight: '900',
  },
  moodFeedback: {
    backgroundColor: '#F5F8F3', borderRadius: 10, padding: 11, marginTop: 13,
    flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
  },
  moodFeedbackText: { color: C.dark, fontSize: 10, fontWeight: '700' },
  inlineLink: { color: C.green, fontSize: 10, fontWeight: '900' },
  featureGrid: { flexDirection: 'row', gap: 10, marginTop: 15, flexWrap: 'wrap' },
  featureCard: { flex: 1, minWidth: 145, borderRadius: 15, padding: 14, minHeight: 170 },
  featureIcon: {
    width: 35, height: 35, borderRadius: 11, backgroundColor: '#DCEBDD',
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { color: C.ink, fontSize: 12, fontWeight: '900', marginTop: 12 },
  featureDesc: { color: '#718077', fontSize: 10, lineHeight: 16, marginTop: 7, flex: 1 },
  featureLink: { color: C.dark, fontSize: 10, fontWeight: '900', marginTop: 12 },
  reminderPanel: {
    backgroundColor: C.white, borderRadius: 19, padding: 20,
    borderWidth: 1, borderColor: C.line, marginBottom: 16,
  },
  reminderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderIcon: { fontSize: 22 },
  reminderStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#C6B58A' },
  statusDotOn: { backgroundColor: '#55A477' },
  statusText: { color: C.muted, fontSize: 8, letterSpacing: 1, fontWeight: '900' },
  reminderHeading: {
    color: C.ink, fontSize: 18, lineHeight: 24, fontWeight: '900', marginTop: 17,
  },
  reminderCopy: { color: C.muted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  reminderTime: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7F2',
    padding: 10, borderRadius: 10, marginTop: 14,
  },
  clockIcon: { color: C.green, fontSize: 17, marginRight: 8 },
  reminderTimeText: { color: C.dark, fontSize: 10, fontWeight: '800' },
  reminderAction: {
    backgroundColor: C.dark, borderRadius: 12, padding: 13,
    alignItems: 'center', marginTop: 13, minHeight: 43, justifyContent: 'center',
  },
  reminderActionText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  browserNote: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 9 },
  quotePanel: { backgroundColor: '#F0ECF7', borderRadius: 19, padding: 20, marginBottom: 16 },
  quoteMark: { color: '#8B7BAA', fontSize: 43, height: 35, fontWeight: '900' },
  quoteText: {
    color: '#4C4560', fontSize: 17, lineHeight: 25, fontWeight: '800', marginTop: 7,
  },
  quoteDivider: { height: 1, backgroundColor: '#DDD6E9', marginVertical: 14 },
  quoteBy: { color: '#82769B', fontSize: 8, letterSpacing: 1, fontWeight: '900' },
  historyLinkCard: {
    backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line,
    padding: 14, flexDirection: 'row', alignItems: 'center',
  },
  historyIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#E8F1E9',
    alignItems: 'center', justifyContent: 'center', marginRight: 11,
  },
  historyTitle: { color: C.ink, fontSize: 11, fontWeight: '900' },
  historySub: { color: C.muted, fontSize: 9, marginTop: 4 },
  historyArrow: { color: C.green, fontSize: 24 },
  footer: { color: '#9AA69D', fontSize: 10, textAlign: 'center', marginTop: 18 },
  chatPanel: {
    backgroundColor: C.white, borderRadius: 20, borderWidth: 1,
    borderColor: C.line, overflow: 'hidden', minHeight: 550,
  },
  chatPanelHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  chatAvatar: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: '#E5F0E7',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  chatAvatarText: { color: C.dark, fontSize: 23 },
  chatPanelTitle: { color: C.ink, fontSize: 13, fontWeight: '900' },
  chatPanelSub: { color: C.muted, fontSize: 10, marginTop: 4 },
  privateLabel: { color: C.green, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  chatArea: { height: 390 },
  chatMessages: { padding: 20, flexGrow: 1 },
  messageBubble: { maxWidth: '85%', padding: 14, borderRadius: 16, marginBottom: 12 },
  aiBubble: {
    backgroundColor: '#EDF4EC', alignSelf: 'flex-start', borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: C.dark, alignSelf: 'flex-end', borderBottomRightRadius: 4,
  },
  messageText: { color: C.ink, fontSize: 13, lineHeight: 20 },
  userMessageText: { color: '#FFF' },
  typingText: { color: C.green, fontSize: 10, marginTop: 6 },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderTopWidth: 1, borderTopColor: C.line, gap: 10,
  },
  chatInput: {
    flex: 1, backgroundColor: '#F5F7F3', borderRadius: 14,
    paddingHorizontal: 15, paddingVertical: 12, color: C.ink,
    maxHeight: 100, fontSize: 13,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: C.dark,
    alignItems: 'center', justifyContent: 'center',
  },
  sendText: { color: '#FFF', fontSize: 19 },
  chatDisclaimer: { color: '#9AA69D', fontSize: 9, textAlign: 'center', padding: 13 },
  breathPanel: {
    backgroundColor: C.white, borderRadius: 21, borderWidth: 1,
    borderColor: C.line, padding: 28, alignItems: 'center',
  },
  breathTitle: {
    color: C.ink, fontSize: 25, fontWeight: '900', marginTop: 7, textAlign: 'center',
  },
  breathIntro: {
    color: C.muted, fontSize: 12, lineHeight: 19, textAlign: 'center',
    maxWidth: 440, marginTop: 9,
  },
  breathVisual: {
    width: 250, height: 250, borderRadius: 125, backgroundColor: '#F0F5EF',
    alignItems: 'center', justifyContent: 'center', marginTop: 27,
  },
  breathRing: {
    width: 205, height: 205, borderRadius: 103, backgroundColor: '#DCEBDD',
    alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: '#EAF3E9',
  },
  breathRingActive: { backgroundColor: '#C5E2CC', borderColor: '#DDEEDF' },
  breathInner: { alignItems: 'center' },
  breathEmoji: { fontSize: 26 },
  breathPhase: { color: C.dark, fontSize: 23, fontWeight: '900', marginTop: 4 },
  breathSeconds: { color: C.green, fontSize: 25, fontWeight: '900', marginTop: 2 },
  secondsUnit: { fontSize: 12, fontWeight: '600' },
  breathInstruction: { color: C.dark, fontSize: 13, fontWeight: '800', marginTop: 16 },
  cycleCount: {
    color: '#9AA69D', fontSize: 9, letterSpacing: 1.2, fontWeight: '900', marginTop: 8,
  },
  phaseGuide: { flexDirection: 'row', gap: 9, width: '100%', marginTop: 24 },
  phaseItem: {
    flex: 1, backgroundColor: '#F6F8F4', borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: C.line,
  },
  phaseItemActive: { backgroundColor: '#E5F0E7', borderColor: C.green },
  phaseNumber: { color: '#9AA69D', fontSize: 9, fontWeight: '900' },
  phaseItemName: { color: C.ink, fontSize: 11, fontWeight: '900', marginTop: 5 },
  phaseItemTime: { color: C.muted, fontSize: 9, marginTop: 4 },
  breathButtons: {
    flexDirection: 'row', gap: 10, marginTop: 22, width: '100%', maxWidth: 440,
  },
  primaryButton: {
    backgroundColor: C.dark, borderRadius: 13, paddingVertical: 14,
    paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center',
    flex: 1, minHeight: 47,
  },
  primaryButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  secondaryButton: {
    backgroundColor: '#F4F7F2', borderRadius: 13, paddingVertical: 14,
    paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', minHeight: 47,
  },
  secondaryButtonText: { color: C.dark, fontSize: 12, fontWeight: '900' },
  breathFoot: { color: C.muted, fontSize: 10, marginTop: 18, textAlign: 'center' },
  journalLayout: { gap: 18 },
  journalCompose: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.line,
    borderRadius: 19, padding: 22,
  },
  journalPrompt: { color: C.ink, fontSize: 20, fontWeight: '900', marginTop: 6 },
  journalHint: { color: C.muted, fontSize: 11, marginTop: 6 },
  journalInput: {
    backgroundColor: '#F7F9F5', borderWidth: 1, borderColor: C.line,
    borderRadius: 14, minHeight: 150, padding: 16, color: C.ink,
    fontSize: 13, lineHeight: 21, marginTop: 17,
  },
  journalComposeBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, marginTop: 13, flexWrap: 'wrap',
  },
  privateNote: { color: C.muted, fontSize: 10 },
  saveButton: { flex: 0, minWidth: 170 },
  entriesSection: {
    backgroundColor: C.white, borderRadius: 19, borderWidth: 1,
    borderColor: C.line, padding: 22,
  },
  entriesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  entryCount: { color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  emptyState: {
    backgroundColor: '#F7F9F5', borderRadius: 14, alignItems: 'center', padding: 27,
  },
  emptyEmoji: { fontSize: 31 },
  emptyTitle: { color: C.ink, fontSize: 13, fontWeight: '900', marginTop: 9 },
  emptyText: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 6 },
  entryCard: { borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 14 },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryDate: { color: C.muted, fontSize: 10 },
  deleteText: { color: '#B65F5F', fontSize: 10, fontWeight: '800', padding: 6 },
  entryText: { color: C.ink, fontSize: 12, lineHeight: 19, marginTop: 7 },
  historySummary: {
    backgroundColor: '#E4EFE5', borderRadius: 19, padding: 23,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 18,
  },
  summaryNumber: { color: C.dark, fontSize: 42, fontWeight: '900', marginTop: 5 },
  summaryLabel: { color: C.green, fontSize: 11 },
  summaryEmoji: { fontSize: 53, marginRight: 10 },
  historyListPanel: {
    backgroundColor: C.white, borderRadius: 19, borderWidth: 1,
    borderColor: C.line, padding: 22,
  },
  moodHistoryItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  moodHistoryIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: '#F3F6F1',
    alignItems: 'center', justifyContent: 'center', marginRight: 13,
  },
  moodHistoryLabel: { color: C.ink, fontSize: 13, fontWeight: '900' },
  moodHistoryDate: { color: C.muted, fontSize: 10, marginTop: 5 },
  moodHistoryChevron: { color: '#9BA89F', fontSize: 23 },
  bottomNav: {
    flexDirection: 'row', backgroundColor: '#FBFCF9', borderTopWidth: 1,
    borderTopColor: C.line, paddingVertical: 8, paddingHorizontal: 3,
    justifyContent: 'space-around',
  },
  bottomNavItem: { alignItems: 'center', flex: 1, paddingVertical: 4 },
  bottomNavIcon: { color: '#93A096', fontSize: 19 },
  bottomNavLabel: { color: '#93A096', fontSize: 8, marginTop: 3 },
  bottomNavActive: { color: C.dark, fontWeight: '900' },
});

export default App;