import React, { useState, useEffect } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const CreateTable = () => {
  const [ticker, setTicker] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [history, setHistory] = useState([]);
  const [errors, setErrors] = useState([]); // Для хранения ошибок
  const [currentPage, setCurrentPage] = useState("table"); // Для переключения страниц

  // Загрузка истории из Local Storage
  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem("history")) || [];
    setHistory(savedHistory);
  }, []);

  // Сохранение новой записи в Local Storage
  const saveToHistory = (ticker, startDate, endDate) => {
    const newEntry = { ticker, startDate, endDate, id: Date.now() };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("history", JSON.stringify(updatedHistory));
  };

  const handleDownloadTable = async () => {
    try {
      if (!ticker || !startDate || !endDate) {
        throw new Error("Заполните все поля!");
      }

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const response = await fetch(
        `${apiUrl}/api/stock/${ticker}?start=${startDate}&end=${endDate}`
      );

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      createExcel(data, ticker);
      saveToHistory(ticker, startDate, endDate); // Сохранение в историю
    } catch (error) {
      console.error("Ошибка загрузки данных:", error.message);
      setErrors((prevErrors) => [...prevErrors, error.message]); // Сохранение ошибки
      alert("Не удалось загрузить данные.");
    }
  };

  const createExcel = (data, tickerName) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${tickerName} Data`);

    worksheet.columns = [
      { header: "Ticker Name", key: "ticker", width: 15 },
      ...data.map((entry) => ({
        header: entry.date,
        key: entry.date,
        width: 15,
      })),
    ];

    const rows = [
      ["Макс цена", ...data.map((entry) => entry.high)],
      ["Мин цена", ...data.map((entry) => entry.low)],
      ["Входная цена", ...data.map((entry) => entry.open)],
      ["Выходная цена", ...data.map((entry) => entry.close)],
    ];

    rows.forEach((row) => worksheet.addRow(row));

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
    });

    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      saveAs(blob, `${tickerName}_Data.xlsx`);
    });
  };

  return (
    <div className="flex h-auto w-screen">
      {/* Админ панель */}
      <aside className="bg-gray-800 text-white w-[250px] p-4 h-screen">
        <h1 className="text-2xl font-bold mb-6">Data Fetcher</h1>
        <button
          className={`py-2 px-4 rounded-full w-full mb-4 ${
            currentPage === "table" ? "bg-green-500" : "bg-white text-gray-800"
          }`}
          onClick={() => setCurrentPage("table")}
        >
          + New table
        </button>
        <button
          className={`py-2 px-4 rounded-full w-full ${
            currentPage === "errConsole"
              ? "bg-green-500"
              : "bg-white text-gray-800"
          }`}
          onClick={() => setCurrentPage("errConsole")}
        >
          Err console
        </button>
      </aside>

      {/* Основная часть */}
      <main className="flex-1 bg-gray-100 p-6">
        {currentPage === "table" && (
          <>
            {/* Форма для ввода данных */}
            <div className="flex items-center space-x-4 mb-6">
              <input
                type="text"
                placeholder="Ticker name..."
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="border px-4 py-2 rounded w-1/3"
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border px-4 py-2 rounded"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border px-4 py-2 rounded"
              />
              <button
                onClick={handleDownloadTable}
                className="bg-green-500 text-white px-6 py-2 rounded"
              >
                Скачать таблицу
              </button>
            </div>

            {/* История таблиц */}
            <div className="mt-6 bg-white p-4 shadow rounded">
              <h2 className="text-lg font-bold mb-4">История таблиц</h2>
              {history.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 bg-gray-200 rounded shadow flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold">{entry.ticker}</p>
                        <p className="text-sm">
                          {entry.startDate} --- {entry.endDate}
                        </p>
                      </div>
                      <button
                        className="text-black "
                        onClick={() => alert(`Загрузка ${entry.ticker}`)}
                      >
                        Загрузить
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">История пуста.</p>
              )}
            </div>
          </>
        )}
        {currentPage === "errConsole" && (
          <div className="bg-white p-4 shadow rounded">
            <h2 className="text-lg font-bold mb-4">Err Console</h2>
            {errors.length > 0 ? (
              <ul className="space-y-2">
                {errors.map((error, index) => (
                  <li
                    key={index}
                    className="p-3 bg-red-100 text-red-700 rounded shadow border border-red-300"
                  >
                    {error}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">Нет ошибок для отображения.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default CreateTable;
