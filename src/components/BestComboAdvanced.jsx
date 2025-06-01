import React, { useState } from "react";

const BestComboAdvanced = () => {
  const [file, setFile] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minSuccessLong, setMinSuccessLong] = useState("");
  const [maxFailLong, setMaxFailLong] = useState("");
  const [minSuccessShort, setMinSuccessShort] = useState("");
  const [maxFailShort, setMaxFailShort] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUploadAndCalculate = async () => {
    if (
      !file ||
      !startDate ||
      !endDate ||
      !minSuccessLong ||
      !maxFailLong ||
      !minSuccessShort ||
      !maxFailShort
    ) {
      alert("Заполните все поля!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    formData.append("minSuccessLong", minSuccessLong);
    formData.append("maxFailLong", maxFailLong);
    formData.append("minSuccessShort", minSuccessShort);
    formData.append("maxFailShort", maxFailShort);

    setIsProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/batch-best-advanced`, {
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
    <div className="p-6 bg-white rounded shadow max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Массовый расчёт лучших комбинаций (Advanced)</h2>

      <div className="flex flex-col gap-4 mb-4">
        <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="border p-2 rounded" />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Лонг % успешных сделок ≥</label>
            <input
              type="number"
              value={minSuccessLong}
              onChange={(e) => setMinSuccessLong(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Лонг % неуспешных сделок ≤</label>
            <input
              type="number"
              value={maxFailLong}
              onChange={(e) => setMaxFailLong(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Шорт % успешных сделок ≥</label>
            <input
              type="number"
              value={minSuccessShort}
              onChange={(e) => setMinSuccessShort(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Шорт % неуспешных сделок ≤</label>
            <input
              type="number"
              value={maxFailShort}
              onChange={(e) => setMaxFailShort(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
        </div>

        <button
          onClick={handleUploadAndCalculate}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={isProcessing}
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

export default BestComboAdvanced;
