import { useState, useEffect } from 'react';
import {
  FaTrash, FaClock, FaChevronDown, FaChevronUp,
  FaFileMedical, FaCode, FaFileInvoice, FaCheckCircle, FaSpinner, FaPlay,
  FaUser, FaExclamationTriangle, FaFilePdf
} from 'react-icons/fa';
import type { Transcription, ICD10Code, CPTCode, PDFDocumentMeta } from '../types';
import {
  generateMedicalNote,
  suggestICD10Codes,
  suggestCPTCodes,
  generateCMS1500Form,
  runFullWorkflow,
  getTranscription,
  downloadPDF,
  getGeneratedPDFs
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Button from './Button';

interface TranscriptionCardProps {
  transcription: Transcription;
  onDelete: (id: number) => void;
  onUpdate?: (transcription: Transcription) => void;
}

export const TranscriptionCard: React.FC<TranscriptionCardProps> = ({ transcription, onDelete, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWorkflowExpanded, setIsWorkflowExpanded] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [availablePDFs, setAvailablePDFs] = useState<PDFDocumentMeta[]>([]);
  const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
  const { isAdministrator } = useAuth();

  // Fetch PDF metadata when the card has a medical note (PDFs may have been generated)
  useEffect(() => {
    if (transcription.medical_note) {
      getGeneratedPDFs(transcription.id)
        .then(data => setAvailablePDFs(data.pdfs))
        .catch(() => {}); // Silently fail — PDFs are optional
    }
  }, [transcription.id, transcription.medical_note]);

  const handleDownloadPDF = async (type: 'clinical-note' | 'billing-packet' | 'patient-summary') => {
    setDownloadingPDF(type);
    try {
      await downloadPDF(transcription.id, type);
      // Refresh PDF metadata after download (PDF is now cached)
      const data = await getGeneratedPDFs(transcription.id);
      setAvailablePDFs(data.pdfs);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    } finally {
      setDownloadingPDF(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de eliminar esta transcripción?')) {
      onDelete(transcription.id);
    }
  };

  const handleWorkflowStep = async (step: string) => {
    setLoadingStep(step);
    try {
      let result;
      switch (step) {
        case 'note':
          result = await generateMedicalNote(transcription.id);
          break;
        case 'icd10':
          result = await suggestICD10Codes(transcription.id);
          break;
        case 'cpt':
          result = await suggestCPTCodes(transcription.id);
          break;
        case 'cms1500':
          result = await generateCMS1500Form(transcription.id);
          break;
        case 'full':
          result = await runFullWorkflow(transcription.id);
          break;
        default:
          return;
      }
      
      if (onUpdate && result.transcription) {
        onUpdate(result.transcription);
      } else {
        // Refresh transcription
        const updated = await getTranscription(transcription.id);
        if (onUpdate) {
          onUpdate(updated);
        }
      }
    } catch (error: any) {
      console.error(`Error in workflow step ${step}:`, error);
      alert(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingStep(null);
    }
  };


  return (
    <div className="card hover:shadow-xl transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <FaUser className="text-[#5FA9DF] text-xl" />
            <div>
              <h3 className="font-bold text-[#0C1523] text-lg">
                {transcription.patient_context?.name ||
                 transcription.patient_id ||
                 'Paciente sin nombre'}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-[#3C4147]">
                <div className="flex items-center space-x-1">
                  <FaClock className="text-[#6B7280]" />
                  <span>{formatDate(transcription.visit_date || transcription.created_at)}</span>
                </div>
                {transcription.visit_duration_minutes && (
                  <span className="text-[#6B7280]">• {transcription.visit_duration_minutes} min</span>
                )}
              </div>
            </div>
          </div>

          {/* Show allergies if present */}
          {transcription.patient_context?.allergies && transcription.patient_context.allergies.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <FaExclamationTriangle className="text-red-500 text-sm" />
              <div className="flex flex-wrap gap-1">
                {transcription.patient_context.allergies.slice(0, 3).map((allergy: any, idx: number) => (
                  <span key={idx} className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                    {allergy.name}
                  </span>
                ))}
                {transcription.patient_context.allergies.length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{transcription.patient_context.allergies.length - 3} más
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
          title="Eliminar transcripción"
        >
          <FaTrash />
        </button>
      </div>

      {/* Transcription Text Preview */}
      <div className="bg-gradient-to-br from-[#F0F8FF] to-[#E0F2FF] rounded-xl p-4 mb-3">
        <p className="text-[#0C1523] leading-relaxed">
          {isExpanded ? transcription.text : transcription.text.slice(0, 150)}
          {transcription.text.length > 150 && !isExpanded && '...'}
        </p>
      </div>

      {/* Expand Button */}
      {transcription.text.length > 150 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center space-x-2 text-[#5FA9DF] hover:text-[#4A9BCE] text-sm font-medium py-2 hover:bg-[#F0F8FF] rounded-lg transition-all duration-200"
        >
          {isExpanded ? (
            <>
              <span>Mostrar menos</span>
              <FaChevronUp />
            </>
          ) : (
            <>
              <span>Mostrar más</span>
              <FaChevronDown />
            </>
          )}
        </button>
      )}

      {/* Metadata */}
      <div className="mt-3 pt-3 border-t border-[#E0F2FF] flex items-center justify-between text-xs text-[#6B7280]">
        <div className="flex items-center space-x-3">
          <span className="bg-[#F0F8FF] px-2 py-1 rounded">
            {transcription.file_size_mb} MB
          </span>
          <span className="bg-[#E0F2FF] text-[#246B8E] px-2 py-1 rounded">
            {transcription.model}
          </span>
        </div>
        <span className="text-[#6B7280]">{transcription.provider}</span>
      </div>

      {/* Medical Workflow Section */}
      <div className="mt-4 pt-4 border-t-2 border-[#C7E7FF]">
        <button
          onClick={() => setIsWorkflowExpanded(!isWorkflowExpanded)}
          className="w-full flex items-center justify-between text-left mb-3"
        >
          <h4 className="font-semibold text-[#0C1523] flex items-center space-x-2">
            <FaFileMedical className="text-[#5FA9DF]" />
            <span>Flujo Médico</span>
          </h4>
          {isWorkflowExpanded ? <FaChevronUp className="text-[#6B7280]" /> : <FaChevronDown className="text-[#6B7280]" />}
        </button>

        {isWorkflowExpanded && (
          <div className="space-y-4">
            {/* Workflow Steps */}
            <div className="space-y-3">
              {/* Step 1: Transcription (always complete) */}
              <div className="flex items-center space-x-3 p-3 bg-[#E0F2FF] rounded-lg">
                <FaCheckCircle className="text-[#246B8E]" />
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">1. Transcripción</p>
                  <p className="text-sm text-[#3C4147]">Completada</p>
                </div>
              </div>

              {/* Step 2: Medical Note */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.medical_note ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.medical_note ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaFileMedical className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">2. Nota Médica Generada</p>
                  {transcription.medical_note ? (
                    <div className="mt-2 p-2 bg-white rounded text-sm text-[#3C4147] max-h-32 overflow-y-auto">
                      {transcription.medical_note.substring(0, 200)}...
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('note')}
                      disabled={loadingStep === 'note'}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'note' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Generando...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Generar Nota</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 3: ICD-10 Codes */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.icd10_codes && transcription.icd10_codes.length > 0 ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.icd10_codes && transcription.icd10_codes.length > 0 ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaCode className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">3. Códigos ICD-10 Sugeridos</p>
                  {transcription.icd10_codes && transcription.icd10_codes.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {transcription.icd10_codes.map((code: ICD10Code, idx: number) => (
                        <div key={idx} className="p-2 bg-white rounded text-sm">
                          <span className="font-mono font-semibold text-[#5FA9DF]">{code.code}</span>
                          <span className="text-[#3C4147] ml-2">{code.description}</span>
                          <span className="text-xs text-[#6B7280] ml-2">({(code.confidence * 100).toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('icd10')}
                      disabled={loadingStep === 'icd10' || !transcription.medical_note}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'icd10' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Sugiriendo...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Sugerir Códigos ICD-10</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 4: CPT Codes */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.cpt_codes && transcription.cpt_codes.length > 0 ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.cpt_codes && transcription.cpt_codes.length > 0 ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaCode className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">4. Códigos CPT + Modificadores</p>
                  {transcription.cpt_codes && transcription.cpt_codes.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {transcription.cpt_codes.map((code: CPTCode, idx: number) => (
                        <div key={idx} className="p-2 bg-white rounded text-sm">
                          <span className="font-mono font-semibold text-[#5FA9DF]">{code.code}</span>
                          {code.modifier && (
                            <span className="font-mono text-[#4A9BCE] ml-1">-{code.modifier}</span>
                          )}
                          <span className="text-[#3C4147] ml-2">{code.description}</span>
                          <span className="text-xs text-[#6B7280] ml-2">({(code.confidence * 100).toFixed(0)}%)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('cpt')}
                      disabled={loadingStep === 'cpt' || !transcription.medical_note}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'cpt' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Sugiriendo...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Sugerir Códigos CPT</>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 5: CMS-1500 Form */}
              <div className={`flex items-center space-x-3 p-3 rounded-lg ${
                transcription.cms1500_form_data ? 'bg-[#E0F2FF]' : 'bg-[#F0F8FF]'
              }`}>
                {transcription.cms1500_form_data ? (
                  <FaCheckCircle className="text-[#246B8E]" />
                ) : (
                  <FaFileInvoice className="text-[#6B7280]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[#0C1523]">5. Formulario CMS-1500 Generado</p>
                  {transcription.cms1500_form_data ? (
                    <div className="mt-2 p-3 bg-white rounded text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold">Diagnóstico Principal:</span>
                          <span className="ml-2 font-mono">{transcription.cms1500_form_data.primary_diagnosis}</span>
                        </div>
                        <div>
                          <span className="font-semibold">Procedimientos:</span>
                          <span className="ml-2">{transcription.cms1500_form_data.procedures?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleWorkflowStep('cms1500')}
                      disabled={loadingStep === 'cms1500' || !transcription.icd10_codes || !transcription.cpt_codes}
                      variant="white"
                      className="mt-2 text-sm"
                    >
                      {loadingStep === 'cms1500' ? (
                        <><FaSpinner className="animate-spin mr-2" /> Generando...</>
                      ) : (
                        <><FaPlay className="mr-2" /> Generar CMS-1500</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Run Full Workflow Button */}
            {transcription.workflow_status !== 'form_created' && (
              <Button
                onClick={() => handleWorkflowStep('full')}
                disabled={loadingStep === 'full'}
                variant="blue"
                fullWidth
                className="flex items-center justify-center space-x-2 disabled:hover:scale-100"
              >
                {loadingStep === 'full' ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Ejecutando flujo completo...</span>
                  </>
                ) : (
                  <>
                    <FaPlay />
                    <span>Ejecutar Flujo Completo</span>
                  </>
                )}
              </Button>
            )}

            {/* PDF Download Section */}
            {transcription.medical_note && (
              <div className="pt-3 border-t border-[#C7E7FF]">
                <h4 className="text-sm font-semibold text-[#0C1523] mb-2 flex items-center gap-2">
                  <FaFilePdf className="text-[#5FA9DF]" />
                  <span>Documentos PDF</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleDownloadPDF('clinical-note')}
                    disabled={downloadingPDF === 'clinical-note'}
                    className="flex items-center gap-1.5 text-xs bg-[#5FA9DF] hover:bg-[#4A9BCE] text-white px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                  >
                    {downloadingPDF === 'clinical-note' ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaFilePdf />
                    )}
                    <span>Nota Clínica</span>
                    {availablePDFs.some(p => p.pdf_type === 'clinical-note') && (
                      <span className="bg-white text-[#5FA9DF] text-xs px-1 rounded font-bold leading-none">✓</span>
                    )}
                  </button>

                  <button
                    onClick={() => handleDownloadPDF('patient-summary')}
                    disabled={downloadingPDF === 'patient-summary'}
                    className="flex items-center gap-1.5 text-xs bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                  >
                    {downloadingPDF === 'patient-summary' ? (
                      <FaSpinner className="animate-spin text-[#5FA9DF]" />
                    ) : (
                      <FaFilePdf className="text-[#5FA9DF]" />
                    )}
                    <span>Resumen Paciente</span>
                    {availablePDFs.some(p => p.pdf_type === 'patient-summary') && (
                      <span className="bg-[#5FA9DF] text-white text-xs px-1 rounded font-bold leading-none">✓</span>
                    )}
                  </button>

                  {isAdministrator && transcription.icd10_codes && transcription.cpt_codes && (
                    <button
                      onClick={() => handleDownloadPDF('billing-packet')}
                      disabled={downloadingPDF === 'billing-packet'}
                      className="flex items-center gap-1.5 text-xs bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                    >
                      {downloadingPDF === 'billing-packet' ? (
                        <FaSpinner className="animate-spin text-[#5FA9DF]" />
                      ) : (
                        <FaFileInvoice className="text-[#5FA9DF]" />
                      )}
                      <span>Billing Packet</span>
                      {availablePDFs.some(p => p.pdf_type === 'billing-packet') && (
                        <span className="bg-[#5FA9DF] text-white text-xs px-1 rounded font-bold leading-none">✓</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

