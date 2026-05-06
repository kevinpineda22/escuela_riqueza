import React, { useState } from 'react';

const LiveChat = () => {
  const [messages, setMessages] = useState([
    { id: 1, user: 'Soporte', text: '¡Bienvenidos al evento VIP! Empezaremos en breve.', isSystem: true },
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setMessages([...messages, { 
      id: Date.now(), 
      user: 'Tú', // En un caso real vendría del auth
      text: newMessage,
      isSystem: false
    }]);
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-full bg-darker border-l border-white/10">
      <div className="p-4 border-b border-white/10 bg-darker/50">
        <h3 className="text-lg font-semibold text-gold">Chat en Vivo VIP</h3>
        <p className="text-xs text-green-400">● Conectado</p>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user === 'Tú' ? 'items-end' : 'items-start'}`}>
            <span className="text-xs text-textMuted mb-1">{msg.user}</span>
            <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${
              msg.isSystem ? 'bg-gold/10 text-gold border border-gold/30' :
              msg.user === 'Tú' ? 'bg-gold text-darker font-medium' : 'bg-dark text-textMain border border-white/5'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10 bg-darker">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-dark border border-white/10 text-textMain rounded-lg px-4 py-2 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
          />
          <button 
            type="submit"
            className="bg-gold hover:bg-goldHover text-darker px-4 py-2 rounded-lg transition-colors font-bold"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};

export default LiveChat;