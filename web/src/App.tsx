import { ConfigProvider } from "antd";
import esES from "antd/locale/es_ES";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { AchievementProvider } from "./features/achievements/AchievementContext";
import { AppRouter } from "./router";
import { habitFerTheme } from "./theme/antdTheme";

export default function App() {
  return (
    <ConfigProvider theme={habitFerTheme} locale={esES}>
      <AuthProvider>
        <AchievementProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AchievementProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}
