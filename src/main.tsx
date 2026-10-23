import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./style.css";
import "./theme.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <main className="recovery-screen">
          <h1>工作台暂时无法显示</h1>
          <p>
            请重新加载恢复最近一次本地保存的画作。如仍然失败，可清除浏览器缓存后重试。
          </p>
          <button className="button primary" onClick={() => location.reload()}>
            重新加载工作台
          </button>
        </main>
      );
    return this.props.children;
  }
}
registerSW({ immediate: true });
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
