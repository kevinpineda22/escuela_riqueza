import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // Validamos contra usuarios de prueba
    if (email === 'vip@escuela.com' && password === 'admin123') {
      setError('');
      navigate('/vip-live');
    } else if (email === 'usuario@premium.com' && password === 'admin123') {
      setError('');
      navigate('/dashboard');
    } else if (email === 'admin@escuela.com' && password === 'admin123') {
      setError('');
      navigate('/admin/upload');
    } else {
      setError('Credenciales invalidas. Intenta con vip@escuela.com, usuario@premium.com o admin@escuela.com');
    }
  };

  return (
    <div className="min-h-screen bg-darker flex flex-col justify-center items-center relative overflow-hidden font-sans p-6">
      {/* Elementos decorativos */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute m-auto h-[400px] w-[400px] rounded-full bg-gold opacity-10 blur-[120px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Link to="/">
            <img src="/LOGO-ESCUELA.webp" alt="Logo Escuela de la Riqueza" className="h-20 mx-auto mb-6 object-contain drop-shadow-md hover:scale-105 transition-transform" />
          </Link>
          <h2 className="text-3xl font-bold text-white mb-2">Bienvenido de nuevo</h2>
          <p className="text-textMuted">Ingresa para continuar tu aprendizaje.</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-textMuted">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  placeholder="usuario@tuempresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-textMuted">Contraseña</label>
                <a href="#" className="text-xs text-gold hover:text-goldHover transition-colors">¿Olvidaste tu contraseña?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/40" size={20} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="w-full py-4 bg-gold hover:bg-goldHover text-darker font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(204,164,59,0.3)] mt-4">
              Iniciar Sesión Premium <ArrowRight size={20} />
            </button>
          </div>
        </form>

        <p className="text-center text-textMuted text-sm mt-8">
          ¿Aún no tienes un plan? <Link to="/#planes" className="text-gold hover:underline">Ver Planes</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;