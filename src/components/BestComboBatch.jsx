import React, { useState } from "react";
import * as XLSX from "xlsx";

const BestComboBatch = () => {
  const [file, setFile] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUploadAndCalculate = async () => {
    if (!file || !startDate || !endDate) {
      alert("Загрузите файл и укажите даты!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);

    setIsProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/batch-best-combo`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Ошибка при расчёте");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Массовый расчёт лучших комбинаций</h2>

      <div className="flex gap-4 mb-4 flex-wrap items-center">
        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="border p-2 rounded" />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded" />

        <button
          onClick={handleUploadAndCalculate}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {isProcessing ? "Обработка..." : "Скачать файл"}
        </button>
      </div>

      {downloadUrl && (
        <a
          href={downloadUrl}
          download="result.xlsx"
          className="inline-block mt-4 text-blue-700 underline"
        >
          Нажмите, чтобы скачать готовый файл
        </a>
      )}
    </div>
  );
};

export default BestComboBatch;
