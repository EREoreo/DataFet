import React, { useState } from "react";

const CalculationComponent = () => {
  const [ticker, setTicker] = useState("GES");
  const [startDate, setStartDate] = useState("2025-02-28");
  const [endDate, setEndDate] = useState("2025-04-01");
  const [profitPercent, setProfitPercent] = useState("4.8"); // Профит в %
  const [lossPercent, setLossPercent] = useState("12");      // Лосс в %

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCalculate = async () => {
    setLoading(true);
    setError("");
    try {
        const apiUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${apiUrl}/api/calculation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Расчет результатов</h2>

      {/* Форма ввода параметров */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-col">
          <label className="mb-1 font-semibold" htmlFor="ticker">
            Тикер
          </label>
          <input
            id="ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="border px-3 py-2 rounded w-40"
            placeholder="Введите тикер"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 font-semibold" htmlFor="startDate">
            Дата начала
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border px-3 py-2 rounded w-40"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 font-semibold" htmlFor="endDate">
            Дата кончала
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border px-3 py-2 rounded w-40"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 font-semibold" htmlFor="profitPercent">
            Профит %
          </label>
          <input
            id="profitPercent"
            type="number"
            value={profitPercent}
            onChange={(e) => setProfitPercent(e.target.value)}
            className="border px-3 py-2 rounded w-20"
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 font-semibold" htmlFor="lossPercent">
            Лосс %
          </label>
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
            className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
          >
            Рассчитать
          </button>
        </div>
      </div>

      {loading && <p>Загрузка данных и расчеты...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((item) => (
            <li
              key={item.startDay}
              className="p-3 border rounded flex justify-between"
            >
              <span>
                Средний результат % в день (начиная с {item.startDay}-го дня):
              </span>
              <span className="font-bold">
                {item.avgResultPerDay}% (Суммарный: {item.totalResultPercent}%, Дней:{" "}
                {item.totalDays})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CalculationComponent;
