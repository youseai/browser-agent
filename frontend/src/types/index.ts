// src/types/index.ts

// WebSocket message types
export type MessageType = 'chat' | 'event' | 'frame';

export interface Message {
  type: MessageType;
  data: any;
}

// Chat messages
export interface ChatMessage {
  text: string;
  sender: 'user' | 'system';
  timestamp: number;
}

// Browser events
export type BrowserEventType = 'click' | 'mousemove' | 'keypress' | 'navigate';

export interface BrowserEvent {
  type: BrowserEventType;
  x?: number;
  y?: number;
  key?: string;
  url?: string;
  timestamp: number;
}

// Navigation actions
export type NavigationAction = 'back' | 'forward' | 'refresh' | 'navigate';

export interface NavigationEvent extends BrowserEvent {
  type: 'navigate';
  action: NavigationAction;
  url?: string;
}