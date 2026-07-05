import { Button, Card, Form, Input, Typography, message } from "antd";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form] = Form.useForm();

  const onFinish = async (values: { login: string; password: string }) => {
    try {
      const data = await login(values.login, values.password);
      if (data.token) localStorage.setItem("habitfer_token", data.token);
      await refresh();
      navigate("/app/picker", { replace: true });
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) {
        message.warning(String(err.response.data?.message ?? "Cuenta pendiente de aprobacion"));
        return;
      }
      message.error("Credenciales invalidas");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Card styles={{ body: { padding: "28px 28px 24px" } }}>
          <Typography.Title level={2} className="auth-brand">Fersua</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
            Habitos personales y proyectos colaborativos en un solo lugar
          </Typography.Paragraph>
          <Form form={form} layout="vertical" onFinish={onFinish} size="large">
            <Form.Item name="login" label="Email o usuario" rules={[{ required: true }]}>
              <Input autoComplete="username" placeholder="tu@email.com" />
            </Form.Item>
            <Form.Item name="password" label="Contrasena" rules={[{ required: true }]}>
              <Input.Password autoComplete="current-password" placeholder="••••••••" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" style={{ marginTop: 8 }}>
              Entrar
            </Button>
          </Form>
          <Typography.Paragraph style={{ marginTop: 20, marginBottom: 0, textAlign: "center" }}>
            No tienes cuenta? <Link to="/register">Registrate</Link>
          </Typography.Paragraph>
        </Card>
      </div>
    </div>
  );
}
