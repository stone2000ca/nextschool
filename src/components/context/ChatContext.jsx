import React, { createContext } from 'react';

// ChatContext holds all state that handleSendMessage needs
export const ChatContext = createContext(null);

// Provider component - wraps Consultant to provide chat state to hooks
export function ChatContextProvider({ children, value }) {
  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

// Hook to safely access ChatContext
export function useChatContext() {
  const context = React.useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatContextProvider');
  }
  return context;
}