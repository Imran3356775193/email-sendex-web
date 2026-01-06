import React, { createContext, useContext, useEffect } from 'react';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ socket, children }) => {
  // Socket event handlers
  const emitEvent = (eventName, data) => {
    if (socket) {
      socket.emit(eventName, data);
    }
  };

  const onEvent = (eventName, callback) => {
    if (socket) {
      socket.on(eventName, callback);
    }
  };

  const offEvent = (eventName, callback) => {
    if (socket) {
      socket.off(eventName, callback);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.removeAllListeners();
      }
    };
  }, [socket]);

  const value = {
    socket,
    emitEvent,
    onEvent,
    offEvent,
    isConnected: socket ? socket.connected : false
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};