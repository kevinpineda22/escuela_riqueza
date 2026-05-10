import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Settings, 
  Palette, 
  CreditCard, 
  Bell, 
  KeySquare, 
  Save, 
  ShieldCheck, 
  CloudRain, 
  Mail,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "brand" | "payments" | "notifications" | "integrations";

// --- Subcomponents ---
const Toggle = ({ enabled, onChange, label, description }: { enabled: boolean; onChange: () => void; label: string; description: string }) => (
  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.07] transition-colors">
    <div className="pr-4">
      <div className="font-semibold text-white text-sm">{label}</div>
      <div className="text-xs text-textMuted mt-1">{description}</div>
    </div>
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        enabled ? "bg-gold" : "bg-white/20"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
          enabled ? "translate-x-5 bg-darker" : "translate-x-0 bg-white/70"
        )}
      />
    </button>
  </div>
);

const InputField = ({ label, type = "text", placeholder, defaultValue = "", disabled = false, secret = false }: any) => (
  <div>
    <label className="block text-sm font-semibold text-textMuted mb-2">{label}</label>
    <input
      type={secret ? "password" : type}
      placeholder={placeholder}
      defaultValue={defaultValue}
      disabled={disabled}
      className={cn(
        "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "focus:outline-none focus:border-gold/50",
        secret && "font-mono text-sm tracking-widest"
      )}
    />
  </div>
);

// --- Main Component ---
const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState<TabId>("brand");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  // Mock State
  const [notifState, setNotifState] = useState({
    welcome: true,
    newModule: true,
    liveReminder: true,
    marketing: false,
  });

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage(null);
    setTimeout(() => {
      setIsSaving(false);
      setSaveMessage({ type: "success", text: "Configuración guardada correctamente." });
      setTimeout(() => setSaveMessage(null), 3000);
    }, 1000);
  };

  const tabs = [
    { id: "brand", label: "Identidad", icon: Palette },
    { id: "payments", label: "Pagos & Planes", icon: CreditCard },
    { id: "notifications", label: "Notificaciones", icon: Bell },
    { id: "integrations", label: "Integraciones", icon: KeySquare },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-140px)]" // Adjusted to fit screen height nicely
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Settings className="text-gold" /> Ajustes del Sistema
          </h1>
          <p className="text-textMuted mt-1">
            Configuración global de la plataforma, integraciones y reglas de negocio.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saveMessage && (
            <motion.span 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              className={cn("text-sm font-semibold px-3 py-1.5 rounded-lg", saveMessage.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}
            >
              {saveMessage.text}
            </motion.span>
          )}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all shadow-[0_4px_14px_rgba(204,164,59,0.4)] flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar Cambios
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 flex-1 min-h-0">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium",
                  isActive 
                    ? "bg-white/10 text-white border border-white/10 shadow-sm" 
                    : "text-textMuted hover:text-white hover:bg-white/5 border border-transparent"
                )}
              >
                <tab.icon size={18} className={isActive ? "text-gold" : "opacity-70"} />
                {tab.label}
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <div className="flex-1 bg-black/30 border border-white/10 rounded-2xl overflow-y-auto custom-scrollbar p-6 relative">
          <AnimatePresence mode="wait">
            {activeTab === "brand" && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Identidad de la Plataforma</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label="Nombre de la Plataforma" defaultValue="Escuela de la Riqueza" />
                    <InputField label="Correo de Soporte" defaultValue="soporte@escuelariqueza.com" />
                  </div>
                </div>
                
                <hr className="border-white/10" />
                
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Logotipos</h3>
                  <div className="flex gap-6">
                    <div className="w-40 h-40 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-gold/30 cursor-pointer transition-colors group">
                      <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center p-3 border border-white/10 group-hover:border-gold/50 transition-colors">
                        <img src="https://imagedelivery.net/HGkLNfdVjFNAti8ZHHgxtQ/18dc9190-6625-4b89-8f1e-3f221e96b500/public" alt="Logo" className="w-full h-full object-contain" />
                      </div>
                      <span className="text-sm font-medium text-textMuted group-hover:text-white">Cambiar Logo</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "payments" && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                  <ShieldCheck className="text-blue-400 mt-0.5 shrink-0" size={20} />
                  <div>
                    <h4 className="text-blue-400 font-bold text-sm">Modo de Pruebas Activo</h4>
                    <p className="text-textMuted text-xs mt-1">Los pagos reales no se procesarán hasta que cambies las llaves a modo de producción.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField label="Moneda Principal" defaultValue="USD ($)" disabled />
                  <InputField label="URL de Webhook" defaultValue="https://app.escuelariqueza.com/api/stripe/webhook" disabled />
                </div>

                <hr className="border-white/10" />

                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><CreditCard size={20} className="text-gold" /> Planes en Stripe</h3>
                  <p className="text-sm text-textMuted mb-6">Asocia los IDs de los productos de Stripe con los roles de la plataforma.</p>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 items-center bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="col-span-3 font-bold text-white">Plan INDIVIDUAL</div>
                      <div className="col-span-9"><InputField label="" placeholder="price_1Nxxxxxxxxxxx" defaultValue="price_1Pindividualmock123" /></div>
                    </div>
                    <div className="grid grid-cols-12 gap-4 items-center bg-gold/5 p-4 rounded-xl border border-gold/20">
                      <div className="col-span-3 font-bold text-gold">Plan VIP</div>
                      <div className="col-span-9"><InputField label="" placeholder="price_1Nxxxxxxxxxxx" defaultValue="price_1Pvipmock456" /></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "notifications" && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Mail size={20} className="text-gold" /> Correos Automáticos</h3>
                  <p className="text-sm text-textMuted mb-6">Gestiona qué correos transaccionales se envían a los usuarios.</p>
                </div>

                <div className="space-y-3">
                  <Toggle 
                    label="Correo de Bienvenida" 
                    description="Se envía automáticamente cuando un usuario confirma su cuenta."
                    enabled={notifState.welcome}
                    onChange={() => setNotifState(s => ({...s, welcome: !s.welcome}))}
                  />
                  <Toggle 
                    label="Nuevo Módulo Disponible" 
                    description="Notifica a los usuarios con plan activo cuando se publica un módulo."
                    enabled={notifState.newModule}
                    onChange={() => setNotifState(s => ({...s, newModule: !s.newModule}))}
                  />
                  <Toggle 
                    label="Recordatorio Evento VIP (1 hora antes)" 
                    description="Envía un aviso a los usuarios VIP antes de que inicie una sala en vivo."
                    enabled={notifState.liveReminder}
                    onChange={() => setNotifState(s => ({...s, liveReminder: !s.liveReminder}))}
                  />
                  <Toggle 
                    label="Boletín Promocional (Marketing)" 
                    description="Permite el envío de correos masivos promocionales desde la plataforma."
                    enabled={notifState.marketing}
                    onChange={() => setNotifState(s => ({...s, marketing: !s.marketing}))}
                  />
                </div>
              </motion.div>
            )}

            {activeTab === "integrations" && (
              <motion.div
                key="integrations"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Cloudflare */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><CloudRain size={18} className="text-[#F38020]" /> Cloudflare Stream & R2</h3>
                  <p className="text-sm text-textMuted mb-6">Credenciales para el alojamiento y entrega de video premium.</p>
                  
                  <div className="space-y-5">
                    <InputField label="Account ID" secret defaultValue="TU_ACCOUNT_ID_AQUI" />
                    <InputField label="Stream API Token" secret defaultValue="TU_STREAM_API_TOKEN_AQUI" />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField label="R2 Access Key" secret defaultValue="TU_R2_ACCESS_KEY_AQUI" />
                      <InputField label="R2 Secret Key" secret defaultValue="TU_R2_SECRET_KEY_AQUI" />
                    </div>
                  </div>
                </div>

                {/* Stripe */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><CreditCard size={18} className="text-[#635BFF]" /> Stripe</h3>
                  <p className="text-sm text-textMuted mb-6">Llaves API para procesamiento de pagos y suscripciones.</p>
                  
                  <div className="space-y-5">
                    <InputField label="Publishable Key (Pública)" defaultValue="pk_test_51NOxxx..." />
                    <InputField label="Secret Key (Privada)" secret defaultValue="sk_test_51NOxxx..." />
                    <InputField label="Webhook Secret" secret defaultValue="whsec_xxxxx..." />
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminSettings;
