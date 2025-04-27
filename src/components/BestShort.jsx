import React, { useState } from "react";

const BestShort = () => {
  const [ticker, setTicker] = useState("GES");
  const [startDate, setStartDate] = useState("2025-02-28");
  const [endDate, setEndDate] = useState("2025-04-01");

  const [bestResult, setBestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFindBest = async () => {
    setLoading(true);
    setError("");
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${apiUrl}/api/best-short`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          startDate,
          endDate,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ошибка сервера");
      }
      setBestResult(data);
    } catch (err) {
      console.error("Ошибка при поиске лучшей комбинации:", err);
      setError(err.message || "Ошибка при поиске.");
    }
    setLoading(false);
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Поиск лучшей комбинации (SHORT)</h2>

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Тикер"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="border px-3 py-2 rounded w-40"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border px-3 py-2 rounded w-40"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border px-3 py-2 rounded w-40"
        />
        <button
          onClick={handleFindBest}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
        >
          Найти лучшую комбинацию
        </button>
      </div>

      {loading && <p>Поиск комбинации...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {bestResult && (
        <div className="p-4 border rounded bg-gray-50">
          <p><strong>Профит %:</strong> {bestResult.profitPercent}</p>
          <p><strong>Лосс %:</strong> {bestResult.lossPercent}</p>
          <p><strong>Средний % в день:</strong> {bestResult.avgResultPerDay?.toFixed(2)}%</p>
        </div>
      )}
    </div>
  );
};

export default BestShort;
