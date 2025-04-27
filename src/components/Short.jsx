import React, { useState } from "react";

const Short = () => {
  const [ticker, setTicker] = useState("GES");
  const [startDate, setStartDate] = useState("2025-02-28");
  const [endDate, setEndDate] = useState("2025-04-01");
  const [profitPercent, setProfitPercent] = useState("4.8");
  const [lossPercent, setLossPercent] = useState("12");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCalculate = async () => {
    setLoading(true);
    setError("");
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${apiUrl}/api/calculation-short`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          startDate,
          endDate,
          profitPercent,
          lossPercent,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ошибка сервера");
      }
      setResults(data.results);
    } catch (err) {
      console.error("Ошибка при выполнении расчетов:", err);
      setError(err.message || "Ошибка при выполнении расчетов.");
    }
    setLoading(false);
  };

  const overallAvg =
    results.length > 0
      ? (
          results.reduce(
            (sum, item) => sum + parseFloat(item.avgResultPerDay),
            0
          ) / results.length
        ).toFixed(2)
      : null;

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Расчет шорт-результатов</h2>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-col">
          <label htmlFor="ticker" className="mb-1 font-semibold">Тикер</label>
          <input
            id="ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="border px-3 py-2 rounded w-40"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="startDate" className="mb-1 font-semibold">Дата начала</label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border px-3 py-2 rounded w-40"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="endDate" className="mb-1 font-semibold">Дата конца</label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border px-3 py-2 rounded w-40"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="profitPercent" className="mb-1 font-semibold">Профит %</label>
          <input
            id="profitPercent"
            type="number"
            value={profitPercent}
            onChange={(e) => setProfitPercent(e.target.value)}
            className="border px-3 py-2 rounded w-20"
          />
        </div>
        <div className="flex flex-col">
          <label htmlFor="lossPercent" className="mb-1 font-semibold">Лосс %</label>
          <input
            id="lossPercent"
            type="number"
            value={lossPercent}
            onChange={(e) => setLossPercent(e.target.value)}
            className="border px-3 py-2 rounded w-20"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleCalculate}
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
          >
            Рассчитать
          </button>
        </div>
      </div>

      {loading && <p>Загрузка данных и расчеты...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {overallAvg !== null && (
        <div className="mb-4 p-3 border rounded bg-gray-50">
          <strong>Общий средний результат % в день:</strong> {overallAvg}%
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((item) => (
            <li
              key={item.startDay}
              className="p-3 border rounded flex justify-between"
            >
              <span>
                Средний результат % в день (начиная со {item.startDay}-го дня):
              </span>
              <span className="font-bold">{item.avgResultPerDay}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Short;
