import { useState } from 'react';
import { FaChevronDown, FaExclamationTriangle, FaPills, FaNotesMedical } from 'react-icons/fa';

interface PatientContextPanelProps {
  patientContext?: {
    medications?: Array<{ name: string; dosage?: string }>;
    allergies?: Array<{ name: string; severity?: string }>;
    problems?: string[];
    recent_visits?: Array<{ date: string; summary: string }>;
  };
}

export const PatientContextPanel: React.FC<PatientContextPanelProps> = ({ patientContext }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!patientContext) return null;

  const hasData =
    (patientContext.allergies && patientContext.allergies.length > 0) ||
    (patientContext.medications && patientContext.medications.length > 0) ||
    (patientContext.problems && patientContext.problems.length > 0);

  if (!hasData) return null;

  return (
    <div className="bg-white rounded-xl border border-blue-100 p-4 mb-4 shadow-sm">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <FaNotesMedical className="text-blue-500" />
          Contexto del Paciente
        </h3>
        <FaChevronDown
          className={`transform transition-transform text-gray-500 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Allergies */}
          {patientContext.allergies && patientContext.allergies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
                <FaExclamationTriangle />
                Alergias
              </h4>
              <div className="flex flex-wrap gap-2">
                {patientContext.allergies.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-red-50 text-red-700 font-semibold px-3 py-1 rounded-full border border-red-200"
                  >
                    {allergy.name}
                    {allergy.severity && ` (${allergy.severity})`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Medications */}
          {patientContext.medications && patientContext.medications.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-1">
                <FaPills />
                Medicamentos Actuales
              </h4>
              <ul className="text-sm text-gray-700 space-y-1 pl-4">
                {patientContext.medications.slice(0, 5).map((med, idx) => (
                  <li key={idx} className="list-disc">
                    <span className="font-medium">{med.name}</span>
                    {med.dosage && <span className="text-gray-500"> ({med.dosage})</span>}
                  </li>
                ))}
                {patientContext.medications.length > 5 && (
                  <li className="text-gray-500 italic">
                    +{patientContext.medications.length - 5} more...
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Chronic Conditions */}
          {patientContext.problems && patientContext.problems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-orange-600 mb-2">📋 Condiciones Crónicas</h4>
              <ul className="text-sm text-gray-700 space-y-1 pl-4">
                {patientContext.problems.slice(0, 3).map((problem, idx) => (
                  <li key={idx} className="list-disc">
                    {problem}
                  </li>
                ))}
                {patientContext.problems.length > 3 && (
                  <li className="text-gray-500 italic">
                    +{patientContext.problems.length - 3} more...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientContextPanel;
