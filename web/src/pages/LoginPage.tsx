import { Button, Form, Input, Typography, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
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
    <AuthLayout title="Bienvenido de nuevo" subtitle="Inicia sesion para acceder a tus apps">
      <Form form={form} layout="vertical" onFinish={onFinish} size="large" className="auth-form">
        <Form.Item name="login" label="Email o usuario" rules={[{ required: true }]}>
          <Input prefix={<UserOutlined style={{ color: "#64748b" }} />} autoComplete="username" placeholder="tu@email.com" />
        </Form.Item>
        <Form.Item name="password" label="Contrasena" rules={[{ required: true }]}>
          <Input.Password
            prefix={<LockOutlined style={{ color: "#64748b" }} />}
            autoComplete="current-password"
            placeholder="Tu contrasena"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" className="auth-submit-btn">
          Entrar a Fersua
        </Button>
      </Form>
      <Typography.Paragraph className="auth-footer-link">
        No tienes cuenta? <Link to="/register">Crear cuenta gratis</Link>
      </Typography.Paragraph>
    </AuthLayout>
  );
}
