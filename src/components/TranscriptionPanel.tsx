import { useState, useRef, useCallback, useEffect } from 'react';
import { FaMicrophoneAlt, FaStop, FaPause, FaPlay, FaTrash, FaFileUpload, FaSpinner } from 'react-icons/fa';
import { useStreamingRecorder } from '../hooks/useStreamingRecorder';
import { useDeepgramStreaming } from '../hooks/useDeepgramStreaming';
import { transcribeAudio, runFullWorkflow } from '../services/api';
import type { Transcription } from '../types';
import Button from './Button';
import { useTranslation } from 'react-i18next';

interface TranscriptionPanelProps {
  onTranscriptionComplete: (transcription: Transcription) => void;
  onWorkflowStart: () => void;
  onWorkflowComplete: (transcription: Transcription) => void;
  onTranscriptionUpdate?: (transcription: Transcription) => void;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  onTranscriptionComplete,
  onWorkflowStart,
  onWorkflowComplete,
}) => {
  const { t, i18n } = useTranslation();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRunningWorkflow, setIsRunningWorkflow] = useState(false);
  const [patientName, setPatientName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  
  // Deepgram streaming hook for real-time transcription
  const {
    isConnected: isDeepgramConnected,
    isConnecting: isDeepgramConnecting,
    transcript: realtimeText,
    interimTranscript,
    error: streamingError,
    connect: connectDeepgram,
    disconnect: disconnectDeepgram,
    sendAudio,
    clearTranscript,
    isReady: isDeepgramReady,
  } = useDeepgramStreaming();
  
  // Callback para enviar audio PCM raw al WebSocket de Deepgram
  const handleAudioData = useCallback((data: ArrayBuffer) => {
    if (isDeepgramReady()) {
      sendAudio(data);
    }
  }, [sendAudio, isDeepgramReady]);
  
  // Streaming recorder hook - captures raw PCM audio
  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    startRecording: originalStartRecording,
    stopRecording: originalStopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording: originalClearRecording,
    error: recorderError,
  } = useStreamingRecorder({
    onAudioData: handleAudioData,
    sampleRate: 16000, // 16kHz for Deepgram
  });
  
  // Wrapper para clearRecording que también limpia la transcripción
  const clearRecording = useCallback(() => {
    clearTranscript();
    disconnectDeepgram();
    originalClearRecording();
  }, [originalClearRecording, clearTranscript, disconnectDeepgram]);
  
  // Auto-scroll when transcript updates
  useEffect(() => {
    if (realtimeText || interimTranscript) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [realtimeText, interimTranscript]);

  // Start recording with Deepgram streaming
  const startRecording = useCallback(async () => {
    try {
      clearTranscript(); // Limpiar transcripción anterior
      setError(null);
      
      // Conectar a Deepgram primero
      if (typeof connectDeepgram !== 'function') {
        setError('Error: función de conexión no disponible');
        return;
      }
      
      const connected = await connectDeepgram();
      
      if (!connected) {
        setError(t('transcription.deepgramConnectionError'));
        return;
      }
      
      // Iniciar grabación
      await originalStartRecording();
    } catch (error: any) {
      console.error('Error al iniciar la grabación:', error);
      setError('Error al iniciar la grabación: ' + (error?.message || 'Unknown'));
    }
  }, [originalStartRecording, connectDeepgram, clearTranscript, t]);
  
  // Stop recording and disconnect from Deepgram
  const stopRecording = useCallback(() => {
    originalStopRecording();
    disconnectDeepgram();
  }, [originalStopRecording, disconnectDeepgram]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/flac', 'audio/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|webm)$/i)) {
      setError(t('transcription.invalidFileType'));
      return;
    }

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(t('transcription.fileTooLarge', { size: formatFileSize(file.size) }));
      return;
    }

    setError(null);
    setUploadedFile(file);
    
    if (audioUrl) {
      clearRecording();
    }
    
    if (uploadedAudioUrl) {
      URL.revokeObjectURL(uploadedAudioUrl);
    }
    const url = URL.createObjectURL(file);
    setUploadedAudioUrl(url);
  };

  const clearUploadedFile = useCallback(() => {
    if (uploadedAudioUrl) {
      URL.revokeObjectURL(uploadedAudioUrl);
    }
    setUploadedFile(null);
    setUploadedAudioUrl(null);
    clearTranscript();
    disconnectDeepgram();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadedAudioUrl, clearTranscript, disconnectDeepgram]);

  const handleTranscribe = async () => {
    const fileToTranscribe = uploadedFile || (audioBlob ? new File([audioBlob], 'recording.webm', { type: audioBlob.type }) : null);
    
    if (!fileToTranscribe) return;

    setIsTranscribing(true);
    setError(null);

    try {
      // Transcribir audio
      const transcription = await transcribeAudio(fileToTranscribe);
      onTranscriptionComplete(transcription);
      
      // Limpiar archivo/grabación después de transcribir (pero mantener la transcripción visible)
      if (uploadedFile) {
        // Limpiar el archivo pero mantener la transcripción
        if (uploadedAudioUrl) {
          URL.revokeObjectURL(uploadedAudioUrl);
        }
        setUploadedFile(null);
        setUploadedAudioUrl(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        clearRecording();
      }
      
      // Limpiar transcripción en tiempo real cuando se completa la transcripción final
      clearTranscript();

      // Ejecutar workflow automáticamente
      setIsRunningWorkflow(true);
      onWorkflowStart();
      
      try {
        const workflowResult = await runFullWorkflow(transcription.id);
        if (workflowResult.transcription) {
          onWorkflowComplete(workflowResult.transcription);
        }
      } catch (workflowError: any) {
        console.error('Error running workflow:', workflowError);
        setError(`${t('transcription.workflowError')} ${workflowError.response?.data?.detail || workflowError.message}`);
      } finally {
        setIsRunningWorkflow(false);
      }
    } catch (err: any) {
      console.error('Error transcribing audio:', err);
      setError(err.response?.data?.detail || t('transcription.transcriptionError'));
    } finally {
      setIsTranscribing(false);
    }
  };

  const today = new Date().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-[#E0F2FF] text-center">
        <p className="text-[#5FA9DF] text-sm font-semibold tracking-wide mb-1">
          {t('transcription.assistantTitle')}
        </p>
        <h2 className="text-2xl font-bold text-[#0C1523]">
          {t('transcription.title')}
        </h2>
        <p className="text-[#0C1523] text-sm mt-1 font-medium">
          {t('transcription.startNewConsultation')}
        </p>
      </div>

      {/* Error Messages */}
      {(error || recorderError) && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error || recorderError}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex-1 flex flex-col min-h-0">
        {!isRecording && !audioBlob && !uploadedFile ? (
          /* Idle: card blanca, centrada */
          <div className="flex-1 flex flex-col justify-center">
            <div className="rounded-2xl bg-white border border-[#E0F2FF] shadow-sm p-8 md:p-10 flex flex-col items-center max-w-md mx-auto w-full">
              {/* Nombre del paciente + Fecha: alineados, misma altura, mismo tipo y tamaño */}
              <div className="grid grid-cols-2 gap-6 w-full mb-8 items-start">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <label htmlFor="patient-name" className="text-[#0C1523] text-sm font-semibold">
                    {t('transcription.patientName')}
                  </label>
                  <input
                    id="patient-name"
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder={t('transcription.patientNamePlaceholder')}
                    className="w-full px-3 py-2 rounded-lg border border-[#E0F2FF] bg-white text-[#0C1523] text-sm font-medium placeholder:text-[#6B7280] placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-[#5FA9DF] focus:border-[#5FA9DF]"
                  />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-[#0C1523] text-sm font-semibold">{t('transcription.date')}</span>
                  <div className="min-h-[42px] flex items-center">
                    <span className="text-[#0C1523] text-sm font-medium">{today}</span>
                  </div>
                </div>
              </div>

              {/* Botón grabar + indicador "Grabar aquí" */}
              <button
                onClick={startRecording}
                className="w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-pink-600 text-white flex items-center justify-center shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-200 mb-3"
              >
                <FaMicrophoneAlt className="text-5xl" />
              </button>
              <p className="text-[#0C1523] text-base font-semibold text-center mb-8">
                {t('transcription.recordHere')}
              </p>

              {/* Subir archivo de audio (abajo, separado) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
                onChange={handleFileUpload}
                className="hidden"
                id="audio-upload"
              />
              <label
                htmlFor="audio-upload"
                className="flex items-center justify-center gap-2 px-6 py-4 bg-[#5FA9DF] text-white rounded-full cursor-pointer hover:bg-[#4A9BCE] transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 font-medium text-base mb-2"
              >
                <FaFileUpload className="text-xl" />
                <span>{t('transcription.uploadAudio')}</span>
              </label>
              <p className="text-xs text-[#6B7280] text-center mb-8">
                {t('transcription.fileFormats')}
              </p>

              {/* Recomendaciones: título claro, subtítulos, fondo y estilo */}
              <div className="w-full rounded-xl bg-[#E0F2FF] border border-[#C7E7FF] p-5">
                <h4 className="text-[#0C1523] text-base font-bold text-center mb-4">
                  {t('transcription.recommendations')}
                </h4>
                <div className="flex flex-col gap-2.5 text-center">
                  <p className="text-[#0C1523] text-sm font-medium">
                    {t('transcription.recommendation1')}
                  </p>
                  <p className="text-[#0C1523] text-sm font-medium">
                    {t('transcription.recommendation2')}
                  </p>
                  <p className="text-[#0C1523] text-sm font-medium">
                    {t('transcription.recommendation3')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Grabando o con audio: controles + Estado */
          <div className="flex flex-col items-center space-y-6 mb-8">
            {/* Estado: tiempo, grabando/pausado, micro-copy empático */}
            <div className="w-full max-w-md rounded-xl bg-white border border-[#E0F2FF] p-4 shadow-sm text-center">
              {isRecording && (
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className={`w-4 h-4 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                  <span className="text-3xl font-mono font-bold text-[#0C1523]">
                    {formatTime(recordingTime)}
                  </span>
                </div>
              )}
              <p className="text-[#0C1523] font-semibold">
                {isRecording && !isPaused && t('transcription.recording')}
                {isRecording && isPaused && t('transcription.paused')}
                {audioBlob && !isTranscribing && t('transcription.readyToProcess')}
                {uploadedFile && !isTranscribing && t('transcription.fileReadyToProcess')}
                {isTranscribing && t('transcription.transcribing')}
                {isRunningWorkflow && t('transcription.generatingNote')}
              </p>
              <p className="text-sm text-[#0C1523] font-medium mt-1.5 opacity-90">
                {isRecording && !isPaused && t('transcription.everyWordCounts')}
                {isRecording && isPaused && t('transcription.resumeHint')}
                {(audioBlob || uploadedFile) && !isTranscribing && !isRunningWorkflow && t('transcription.reviewHint')}
                {(isTranscribing || isRunningWorkflow) && t('transcription.pleaseWait')}
              </p>
            </div>

            {isRecording && (
              <div className="flex items-center space-x-5">
                <button
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  className="w-20 h-20 rounded-full bg-yellow-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  {isPaused ? <FaPlay className="text-3xl" /> : <FaPause className="text-3xl" />}
                </button>
                <button
                  onClick={stopRecording}
                  className="w-28 h-28 rounded-full bg-[#0C1523] text-white flex items-center justify-center shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
                >
                  <FaStop className="text-4xl" />
                </button>
              </div>
            )}

            {/* Audio Player + Transcribir / Descartar */}
            {((audioUrl && !isRecording) || uploadedFile) && (
              <div className="w-full max-w-md space-y-4">
                <div className="bg-[#F0F8FF] rounded-xl p-4 border border-[#E0F2FF]">
                  {uploadedFile && (
                    <div className="mb-3 pb-3 border-b border-[#E0F2FF]">
                      <p className="text-sm text-[#0C1523] font-semibold mb-1">{t('transcription.file')}</p>
                      <p className="text-sm font-medium text-[#0C1523]">{uploadedFile.name}</p>
                      <p className="text-xs text-[#0C1523] font-medium">
                        {t('transcription.fileSize')} {formatFileSize(uploadedFile.size)}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-[#0C1523] font-semibold mb-2">
                    {uploadedFile ? t('transcription.playPreview') : t('transcription.audioPreview')}
                  </p>
                  <audio src={uploadedFile ? uploadedAudioUrl || '' : audioUrl || ''} controls className="w-full" />
                </div>

                <div className="flex space-x-3">
                  <Button
                    onClick={handleTranscribe}
                    disabled={isTranscribing || isRunningWorkflow}
                    variant="blue"
                    fullWidth
                    className="flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTranscribing || isRunningWorkflow ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        <span>{isTranscribing ? t('transcription.transcribingStatus') : t('transcription.executingWorkflow')}</span>
                      </>
                    ) : (
                      <span>{t('transcription.transcribeAndExecute')}</span>
                    )}
                  </Button>

                  <Button
                    onClick={() => {
                      if (uploadedFile) {
                        clearUploadedFile();
                      } else {
                        clearRecording();
                      }
                    }}
                    disabled={isTranscribing || isRunningWorkflow}
                    variant="white"
                    className="flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <FaTrash />
                    <span>{t('transcription.discard')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transcripción en tiempo real - Mostrar durante la grabación y después si hay texto */}
      {(isRecording || realtimeText || interimTranscript || isDeepgramConnecting) && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-[#E0F2FF] shadow-sm transition-all duration-300">
          <div className="flex items-center space-x-2 mb-3">
            <div className="relative">
              {(isRecording || isDeepgramConnecting) && (
                <>
                  <FaSpinner className={`text-[#5FA9DF] text-lg ${(isDeepgramConnecting || interimTranscript) ? 'animate-spin' : ''}`} />
                  {interimTranscript && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#5FA9DF] rounded-full animate-ping"></div>
                    </div>
                  )}
                </>
              )}
              {!isRecording && !isDeepgramConnecting && realtimeText && (
                <div className="w-4 h-4 bg-[#246B8E] rounded-full"></div>
              )}
            </div>
            <h3 className="text-base font-semibold text-[#0C1523]">
              {isDeepgramConnecting ? t('transcription.connecting') : isRecording ? t('transcription.realTimeTranscription') : t('transcription.recordingTranscription')}
            </h3>
            {isRecording && isPaused && (
              <span className="ml-2 text-xs bg-[#E0F2FF] text-[#0C1523] font-semibold px-2 py-1 rounded">{t('transcription.paused')}</span>
            )}
            {isRecording && !isPaused && isDeepgramConnected && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded animate-pulse">{t('transcription.live')}</span>
            )}
            {!isRecording && realtimeText && (
              <span className="ml-2 text-xs bg-[#E0F2FF] text-[#0C1523] font-medium px-2 py-1 rounded">{t('transcription.recordingFinished')}</span>
            )}
          </div>
          
          {/* Streaming error */}
          {streamingError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              {t('transcription.streamingError')} {streamingError}
            </div>
          )}
          
          <div className="min-h-[150px] max-h-[300px] bg-white rounded-lg p-4 border border-[#E0F2FF] overflow-y-auto transition-all duration-200">
            {(realtimeText || interimTranscript) ? (
              <div className="relative">
                <p className="text-[#0C1523] leading-relaxed whitespace-pre-wrap text-sm transition-opacity duration-200">
                  {/* When there's an interim transcript, it contains the full text up to now, so show it */}
                  {/* When there's no interim, show the final transcript */}
                  {interimTranscript ? (
                    <>
                      {/* Show the interim transcript (includes all text up to current moment) */}
                      <span className="text-[#0C1523]">{realtimeText}</span>
                      {/* Show only the new part being typed (interim minus what's already final) */}
                      {interimTranscript.startsWith(realtimeText) ? (
                        <span className="text-[#5FA9DF] opacity-80 font-medium">
                          {interimTranscript.substring(realtimeText.length)}
                        </span>
                      ) : (
                        <span className="text-[#5FA9DF] opacity-80 font-medium">
                          {interimTranscript}
                        </span>
                      )}
                    </>
                  ) : (
                    /* No interim, just show final transcript */
                    realtimeText
                  )}
                  {/* Show blinking cursor when recording */}
                  {isRecording && isDeepgramConnected && (
                    <span className="inline-block ml-1 animate-pulse text-[#5FA9DF] font-bold">▊</span>
                  )}
                </p>
                {/* Auto-scroll al final cuando hay nuevo texto */}
                <div ref={scrollEndRef} className="h-0" />
              </div>
            ) : (
              <p className="text-[#0C1523] italic text-sm font-medium text-center py-8">
                {isDeepgramConnecting 
                  ? (
                    <span className="flex items-center justify-center space-x-2">
                      <FaSpinner className="animate-spin text-[#5FA9DF]" />
                      <span>{t('transcription.connectingToDeepgram')}</span>
                    </span>
                  )
                  : isRecording && isDeepgramConnected
                  ? t('transcription.youCanSpeakNow')
                  : t('transcription.speakToSeeTranscription')}
              </p>
            )}
          </div>
          {(realtimeText || interimTranscript) && (
            <div className="mt-2 flex items-center justify-between text-xs">
              <p className="text-[#0C1523] font-medium">
                {isRecording && isDeepgramConnected ? t('transcription.streamingLive') : t('transcription.transcriptionCompleted')}
              </p>
              <p className="text-[#0C1523] font-semibold">
                {(realtimeText + ' ' + (interimTranscript || '')).trim().split(/\s+/).filter(w => w).length} {t('transcription.words')}
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

