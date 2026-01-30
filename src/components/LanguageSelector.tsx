import { useTranslation } from 'react-i18next';
import { FaGlobe } from 'react-icons/fa';

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center space-x-2">
      <FaGlobe className="text-[#0C1523] text-sm" />
      <select
        value={i18n.language || 'es'}
        onChange={(e) => changeLanguage(e.target.value)}
        className="bg-white border border-[#E0F2FF] rounded-lg px-3 py-1.5 text-sm font-medium text-[#0C1523] focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] cursor-pointer"
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>
    </div>
  );
};
