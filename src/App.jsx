import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import CreateTable from "./components/CreateTable";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // При загрузке приложения читаем состояние из sessionStorage
  useEffect(() => {
    const auth = sessionStorage.getItem("isAuthenticated");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem("isAuthenticated", "true");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("isAuthenticated");
    setIsAuthenticated(false);
  };

  return (
    <div>
      {isAuthenticated ? (
        <>
          
          <CreateTable />
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
