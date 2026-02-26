import { useCallback } from 'react';

export const useBriefConfirmHandler = (currentConversation, setCurrentConversation, handleSendMessage) => {
  return useCallback(() => {
    const updatedContext = {
      ...currentConversation?.conversationContext,
      state: 'RESULTS',
      briefStatus: 'confirmed'
    };
    setCurrentConversation(prev => ({
      ...prev,
      conversationContext: updatedContext
    }));
    handleSendMessage("That looks right - show me schools", null, updatedContext);
  }, [currentConversation, setCurrentConversation, handleSendMessage]);
};