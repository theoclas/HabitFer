import { Button, Form, Input, Result, Typography, message } from "antd";
import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { useAuth } from "../contexts/AuthContext";

export function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [pending, setPending] = useState(false);

  const onFinish = async (values: { email: string; username: string; fullName: string; password: string }) => {
    try {
      const data = await register(values);
      if (data.pending) {
        setPending(true);
        message.info(data.message ?? "Cuenta pendiente de aprobacion");
        return;
      }
      if (data.token) localStorage.setItem("habitfer_token", data.token);
      await refresh();
      navigate("/app/picker", { replace: true });
    } catch {
      message.error("No se pudo crear la cuenta");
    }
  };

  if (pending) {
    return (
      <AuthLayout title="Solicitud enviada" subtitle="Tu cuenta esta pendiente de aprobacion">
        <Result
          status="info"
          title="Revisa tu correo"
          subTitle="Un administrador revisara tu solicitud. Podras iniciar sesion cuando sea aprobada."
          extra={
            <Link to="/login">
              <Button type="primary" className="auth-submit-btn">
                Ir a iniciar sesion
              </Button>
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Crear cuenta" subtitle="Unete a Fersua y organiza tu vida y proyectos" wide>
      <Form layout="vertical" onFinish={onFinish} size="large" className="auth-form">
        <Form.Item name="fullName" label="Nombre completo" rules={[{ required: true }]}>
          <Input prefix={<UserOutlined style={{ color: "#64748b" }} />} placeholder="Tu nombre" />
        </Form.Item>
        <Form.Item name="username" label="Usuario" rules={[{ required: true }]}>
          <Input prefix={<UserOutlined style={{ color: "#64748b" }} />} placeholder="usuario" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
          <Input prefix={<MailOutlined style={{ color: "#64748b" }} />} placeholder="tu@email.com" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Contrasena"
          rules={[
            { required: true, min: 12 },
            { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: "Mayuscula, minuscula y numero" },
          ]}
        >
          <Input.Password prefix={<LockOutlined style={{ color: "#64748b" }} />} placeholder="Min. 12 caracteres" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" className="auth-submit-btn">
          Registrarme
        </Button>
      </Form>
      <Typography.Paragraph className="auth-footer-link">
        Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
      </Typography.Paragraph>
    </AuthLayout>
  );
}
