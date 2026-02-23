import axios from 'axios';
import type {
  Transcription,
  TranscriptionListResponse,
  HealthCheck,
  WorkflowStepResponse,
  PatientInfo,
  EHRConnection,
  EHRConnectionCreate,
  EHRListResponse,
  EHRAuthorizationResponse,
  EHRSyncRequest,
  EHRSyncResponse,
  EHRPatient,
  User,
  LoginRequest,
  LoginResponse,
  PDFDocumentMeta,
  NudgeItem
} from '../types';

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

console.log('🔧 API Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE_URL,
  finalBaseURL: API_BASE_URL
});

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Log detallado de la petición
  const fullUrl = `${config.baseURL}${config.url}`;
  console.log('📤 API Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullURL: fullUrl,
    data: config.data,
    headers: config.headers
  });
  
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      fullURL: `${response.config.baseURL}${response.config.url}`,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'N/A',
      requestURL: error.request?.responseURL,
      responseData: error.response?.data,
      responseHeaders: error.response?.headers
    });
    
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== Authentication Endpoints ====================

// Login
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/api/auth/login', credentials);
  // Guardar token y usuario
  localStorage.setItem('auth_token', response.data.access_token);
  localStorage.setItem('user', JSON.stringify(response.data.user));
  return response.data;
};

// Logout
export const logout = async (): Promise<void> => {
  await api.post('/api/auth/logout');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
};

// Get current user
export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<User>('/api/auth/me');
  return response.data;
};

// Register público
export const register = async (userData: {
  email: string;
  full_name: string;
  password: string;
  role?: 'doctor' | 'administrator';
}): Promise<User> => {
  console.log('🔐 Register function called with:', {
    userData: { ...userData, password: '***' }, // No loguear password completo
    apiBaseURL: API_BASE_URL,
    endpoint: '/api/auth/register',
    fullURL: `${API_BASE_URL}/api/auth/register`
  });
  
  try {
    const response = await api.post<User>('/api/auth/register', userData);
    console.log('✅ Register successful:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Register failed:', {
      error,
      message: error.message,
      response: error.response,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
};

// Health Check
export const healthCheck = async (): Promise<HealthCheck> => {
  const response = await api.get<HealthCheck>('/api/health');
  return response.data;
};

// Transcribir audio (solo modelo básico, sin selección)
export const transcribeAudio = async (audioFile: File): Promise<Transcription> => {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await api.post<Transcription>('/api/transcriptions/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Transcribir chunk de audio para tiempo real
export const transcribeAudioChunk = async (audioChunk: Blob): Promise<{ text: string; status: string }> => {
  const formData = new FormData();
  formData.append('audio', audioChunk, 'chunk.webm');

  const response = await api.post<{ text: string; status: string }>('/api/transcriptions/transcribe-chunk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

// Obtener lista de transcripciones
export const getTranscriptions = async (
  skip: number = 0,
  limit: number = 10
): Promise<TranscriptionListResponse> => {
  const response = await api.get<TranscriptionListResponse>('/api/transcriptions/', {
    params: { skip, limit },
  });
  return response.data;
};

// Obtener una transcripción específica
export const getTranscription = async (id: number): Promise<Transcription> => {
  const response = await api.get<Transcription>(`/api/transcriptions/${id}`);
  return response.data;
};

// Eliminar una transcripción
export const deleteTranscription = async (id: number): Promise<void> => {
  await api.delete(`/api/transcriptions/${id}`);
};

// ==================== Medical Workflow Endpoints ====================

// Generate medical note from transcription
export const generateMedicalNote = async (transcriptionId: number): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/generate-note`
  );
  return response.data;
};

// Suggest ICD-10 codes
export const suggestICD10Codes = async (transcriptionId: number): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/suggest-icd10`
  );
  return response.data;
};

// Suggest CPT codes
export const suggestCPTCodes = async (transcriptionId: number): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/suggest-cpt`
  );
  return response.data;
};

// Generate CMS-1500 form
export const generateCMS1500Form = async (
  transcriptionId: number,
  patientInfo?: PatientInfo
): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/generate-cms1500`,
    patientInfo
  );
  return response.data;
};

// Run full workflow (all steps at once)
export const runFullWorkflow = async (
  transcriptionId: number,
  patientInfo?: PatientInfo
): Promise<WorkflowStepResponse> => {
  const response = await api.post<WorkflowStepResponse>(
    `/api/transcriptions/${transcriptionId}/workflow/run-full`,
    patientInfo
  );
  return response.data;
};

// ==================== PDF Export Endpoints ====================

// Download PDF reports
export const downloadPDF = async (
  transcriptionId: number,
  type: 'clinical-note' | 'billing-packet' | 'patient-summary'
): Promise<void> => {
  try {
    console.log(`📥 Downloading PDF: ${type} for transcription ${transcriptionId}`);

    const response = await api.get(
      `/api/transcriptions/${transcriptionId}/pdf/${type}`,
      {
        responseType: 'blob', // Important: tell axios to expect binary data
      }
    );

    console.log('✅ PDF received, size:', response.data.size);

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `${type}_${transcriptionId}_${date}.pdf`;
    link.setAttribute('download', filename);

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
      console.log(`✅ PDF downloaded: ${filename}`);
    }, 100);
  } catch (error: any) {
    console.error('❌ PDF download failed:', error);
    console.error('Error details:', error.response?.data);
    alert(`Error al descargar PDF: ${error.response?.data?.detail || error.message}`);
    throw error;
  }
};

// Get list of generated PDFs metadata for a transcription (no binary data)
export const getGeneratedPDFs = async (transcriptionId: number): Promise<{
  transcription_id: number;
  pdfs: PDFDocumentMeta[];
}> => {
  const response = await api.get(`/api/transcriptions/${transcriptionId}/pdfs`);
  return response.data;
};

// Map transcript text to SOAP sections (POST /{id}/soap/map-continuous)
export const mapSOAPSections = async (
  transcriptionId: number,
  transcriptText: string
): Promise<{ success: boolean; soap_sections: any; documentation_completeness: any }> => {
  const response = await api.post(
    `/api/transcriptions/${transcriptionId}/soap/map-continuous`,
    null,
    { params: { transcription_text: transcriptText } }
  );
  return response.data;
};

// Get live clarification nudges during recording (no transcription ID needed)
export const getLiveSuggestions = async (
  transcriptText: string
): Promise<{ nudges: NudgeItem[] }> => {
  const response = await api.post('/api/transcriptions/live-nudges', {
    transcript_text: transcriptText,
  });
  return response.data;
};

// ==================== EHR Integration Endpoints ====================

// Create EHR connection
export const createEHRConnection = async (connectionData: EHRConnectionCreate): Promise<EHRConnection> => {
  const response = await api.post<EHRConnection>('/api/ehr/connections', connectionData);
  return response.data;
};

// Get EHR connections list
export const getEHRConnections = async (
  skip: number = 0,
  limit: number = 10,
  activeOnly: boolean = false
): Promise<EHRListResponse> => {
  const response = await api.get<EHRListResponse>('/api/ehr/connections', {
    params: { skip, limit, active_only: activeOnly },
  });
  return response.data;
};

// Get specific EHR connection
export const getEHRConnection = async (connectionId: number): Promise<EHRConnection> => {
  const response = await api.get<EHRConnection>(`/api/ehr/connections/${connectionId}`);
  return response.data;
};

// Update EHR connection
export const updateEHRConnection = async (
  connectionId: number,
  updateData: Partial<EHRConnection>
): Promise<EHRConnection> => {
  const response = await api.put<EHRConnection>(`/api/ehr/connections/${connectionId}`, updateData);
  return response.data;
};

// Delete EHR connection
export const deleteEHRConnection = async (connectionId: number): Promise<void> => {
  await api.delete(`/api/ehr/connections/${connectionId}`);
};

// Get authorization URL for OAuth2
export const getEHRAuthorizationUrl = async (
  connectionId: number,
  redirectUri: string,
  scopes?: string[]
): Promise<EHRAuthorizationResponse> => {
  const response = await api.post<EHRAuthorizationResponse>(
    `/api/ehr/connections/${connectionId}/authorize`,
    null,
    {
      params: { redirect_uri: redirectUri, scopes },
    }
  );
  return response.data;
};

// Handle OAuth2 callback
export const handleEHRAuthorizationCallback = async (
  connectionId: number,
  code: string,
  redirectUri: string,
  state?: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.post(
    `/api/ehr/connections/${connectionId}/callback`,
    null,
    {
      params: { code, redirect_uri: redirectUri, state },
    }
  );
  return response.data;
};

// Sync transcription to EHR
export const syncTranscriptionToEHR = async (
  syncData: EHRSyncRequest
): Promise<EHRSyncResponse> => {
  const response = await api.post<EHRSyncResponse>(
    `/api/ehr/connections/${syncData.connection_id}/sync`,
    {
      transcription_id: syncData.transcription_id,
      patient_id: syncData.patient_id,
      sync_types: syncData.sync_types,
    }
  );
  return response.data;
};

// Search patients in EHR
export const searchEHRPatients = async (
  connectionId: number,
  name?: string,
  identifier?: string,
  birthdate?: string
): Promise<EHRPatient[]> => {
  const response = await api.post<EHRPatient[]>(
    `/api/ehr/connections/${connectionId}/patients/search`,
    null,
    {
      params: { name, identifier, birthdate },
    }
  );
  return response.data;
};

// Get EHR capabilities
export const getEHRCapabilities = async (connectionId: number): Promise<any> => {
  const response = await api.get(`/api/ehr/connections/${connectionId}/capabilities`);
  return response.data;
};

export default api;

