import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaUser, FaLock, FaStethoscope, FaUserPlus } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../components/LanguageSelector';
import { register } from '../services/api';

export const Login = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'doctor' | 'administrator'>('doctor');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    console.log('📝 Form submitted:', {
      isRegisterMode,
      email,
      fullName: isRegisterMode ? fullName : 'N/A',
      role: isRegisterMode ? role : 'N/A',
      passwordLength: password.length
    });

    try {
      if (isRegisterMode) {
        console.log('🚀 Attempting registration with:', {
          email,
          full_name: fullName,
          role,
          passwordLength: password.length
        });
        
        const registerData = { email, full_name: fullName, password, role };
        console.log('📦 Register data to send:', { ...registerData, password: '***' });
        
        await register(registerData);
        console.log('✅ Registration successful!');
        setSuccess(t('auth.registerSuccess'));
        // Cambiar a modo login después de 2 segundos
        setTimeout(() => {
          setIsRegisterMode(false);
          setSuccess(null);
        }, 2000);
      } else {
        await login({ email, password });
        navigate('/');
      }
    } catch (err: any) {
      console.error('❌ Form submission error:', {
        error: err,
        message: err.message,
        response: err.response,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config,
        requestURL: err.request?.responseURL
      });
      
      setError(
        isRegisterMode
          ? err.response?.data?.detail || t('auth.registerError')
          : err.response?.data?.detail || t('auth.loginError')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg mb-4">
            <FaStethoscope className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Wellbyn Notes
          </h1>
          <p className="text-gray-600">
            {t('app.systemTitle')}
          </p>
        </div>

        {/* Login/Register Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900">
              {isRegisterMode ? t('auth.register') : t('auth.login')}
            </h2>
            <LanguageSelector />
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name (solo en modo registro) */}
            {isRegisterMode && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.fullName')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUserPlus className="text-gray-400" />
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder={t('auth.fullNamePlaceholder')}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
            </div>

            {/* Role Selection (solo en modo registro, para desarrollo) */}
            {isRegisterMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role (Development Only)
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="doctor"
                      checked={role === 'doctor'}
                      onChange={(e) => setRole(e.target.value as 'doctor' | 'administrator')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Doctor</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="administrator"
                      checked={role === 'administrator'}
                      onChange={(e) => setRole(e.target.value as 'doctor' | 'administrator')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Administrator</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Solo para desarrollo - permite seleccionar el tipo de usuario
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {isLoading
                ? isRegisterMode
                  ? t('auth.registering')
                  : t('auth.loggingIn')
                : isRegisterMode
                ? t('auth.register')
                : t('auth.login')}
            </button>
          </form>

          {/* Switch between login and register */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setError(null);
                setSuccess(null);
                setEmail('');
                setPassword('');
                setFullName('');
                setRole('doctor');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {isRegisterMode ? (
                <>
                  {t('auth.alreadyHaveAccount')} {t('auth.switchToLogin')}
                </>
              ) : (
                <>
                  {t('auth.dontHaveAccount')} {t('auth.switchToRegister')}
                </>
              )}
            </button>
          </div>

          {/* Footer */}
          {!isRegisterMode && (
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>{t('auth.restrictedAccess')}</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>{t('auth.needHelp')}</p>
        </div>
      </div>
    </div>
  );
};
