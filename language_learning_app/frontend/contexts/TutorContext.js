import React, { createContext, useContext, useState } from 'react';

const TutorContext = React.createContext({
  openTutor: () => {},
  closeTutor: () => {},
  isOpen: false,
});

export function TutorProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = {
    openTutor: () => setIsOpen(true),
    closeTutor: () => setIsOpen(false),
    isOpen,
  };
  return (
    <TutorContext.Provider value={value}>
      {children}
    </TutorContext.Provider>
  );
}

export function useTutor() {
  const ctx = useContext(TutorContext);
  if (!ctx) return { openTutor: () => {}, closeTutor: () => {}, isOpen: false };
  return ctx;
}
