import { ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AppRouter } from "./router";
import { habitFerTheme } from "./theme/antdTheme";

export default function App() {
  return (
    <ConfigProvider theme={habitFerTheme} locale={esES}>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}
