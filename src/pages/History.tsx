import { useEffect, useState } from 'react';
import { FaSync, FaInbox } from 'react-icons/fa';
import { getTranscriptions, deleteTranscription } from '../services/api';
import { TranscriptionCard } from '../components/TranscriptionCard';
import type { Transcription } from '../types';
import Button from '../components/Button';
import { useTranslation } from 'react-i18next';

export const History = () => {
  const { t } = useTranslation();
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchTranscriptions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getTranscriptions(0, 50);
      setTranscriptions(data.items);
      setTotal(data.total);
    } catch (err: any) {
      console.error('Error fetching transcriptions:', err);
      setError(t('history.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscriptions();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteTranscription(id);
      setTranscriptions(prev => prev.filter(t => t.id !== id));
      setTotal(prev => prev - 1);
    } catch (err: any) {
      console.error('Error deleting transcription:', err);
      alert(t('history.deleteError'));
    }
  };

  const handleUpdate = async (updatedTranscription: Transcription) => {
    setTranscriptions(prev => 
      prev.map(t => t.id === updatedTranscription.id ? updatedTranscription : t)
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5FA9DF] mx-auto mb-4"></div>
          <p className="text-[#3C4147]">{t('history.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">⚠️ {error}</p>
          <Button onClick={fetchTranscriptions} variant="blue">
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex justify-center">
      <div className="w-full max-w-3xl px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#0C1523] mb-2">
            {t('history.title')}
          </h2>
          <p className="text-[#0C1523] font-medium">
            {t('common.total')}: <span className="font-semibold">{total}</span> {t('history.transcriptions')}
          </p>
        </div>
        
        <button
          onClick={fetchTranscriptions}
          className="flex items-center space-x-2 text-[#5FA9DF] hover:text-[#4A9BCE] font-medium hover:bg-[#F0F8FF] px-4 py-2 rounded-full transition-all duration-200"
        >
          <FaSync className="animate-spin-slow" />
          <span>{t('common.refresh')}</span>
        </button>
      </div>

      {/* List */}
      {transcriptions.length === 0 ? (
        <div className="card text-center py-12">
          <FaInbox className="text-6xl text-[#C7E7FF] mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#0C1523] mb-2">
            {t('history.empty')}
          </h3>
          <p className="text-[#0C1523] font-medium">
            {t('history.emptyMessage')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcriptions.map((transcription) => (
            <TranscriptionCard
              key={transcription.id}
              transcription={transcription}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
};

