import { useState } from 'react';

const Finviz = () => {
  const [nyseStatus, setNyseStatus] = useState('idle');
  const [nasdaqStatus, setNasdaqStatus] = useState('idle');

  const handleDownload = async (exchange) => {
    const setStatus = exchange === 'nyse' ? setNyseStatus : setNasdaqStatus;
    setStatus('loading');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/finviz?exchange=${exchange}`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Ошибка при скачивании');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${exchange}_tickers.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setStatus('ready');
    } catch (err) {
      alert('❌ ' + err.message);
      setStatus('idle');
    }
  };

  const renderBlock = (title, status, onDownload) => (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-xl shadow w-auto">
      <h2 className="text-xl font-semibold">{title}</h2>
      {status === 'idle' && (
        <button
          onClick={onDownload}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          📥 Скачать таблицу
        </button>
      )}
      {status === 'loading' && (
        <div className="px-4 py-2 border rounded text-gray-700 bg-yellow-100">
          ⏳ Таблица готовится...
        </div>
      )}
      {status === 'ready' && (
        <div className="px-4 py-2 border rounded text-green-700 bg-green-100">
          ✅ Готово! Таблица скачана.
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-start px-8 py-8">
      <div className="flex flex-col sm:flex-row gap-8">
        {renderBlock('NYSE', nyseStatus, () => handleDownload('nyse'))}
        {renderBlock('NASDAQ', nasdaqStatus, () => handleDownload('nasdaq'))}
      </div>
    </div>
  );
};

export default Finviz;
