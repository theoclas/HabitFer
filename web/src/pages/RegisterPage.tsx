import { Button, Card, Form, Input, Result, Typography, message } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/client";
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
      <div className="auth-page">
        <div className="auth-card">
          <Card styles={{ body: { padding: "28px" } }}>
            <Result
              status="info"
              title="Solicitud enviada"
              subTitle="Tu cuenta fue creada y esta pendiente de aprobacion por un administrador. Recibiras acceso cuando sea aprobada."
              extra={<Link to="/login"><Button type="primary">Ir a iniciar sesion</Button></Link>}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Card styles={{ body: { padding: "28px 28px 24px" } }}>
          <Typography.Title level={2} className="auth-brand">Crear cuenta</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
            Registrate y espera la aprobacion del administrador para acceder
          </Typography.Paragraph>
          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item name="fullName" label="Nombre" rules={[{ required: true }]}>
              <Input placeholder="Tu nombre" />
            </Form.Item>
            <Form.Item name="username" label="Usuario" rules={[{ required: true }]}>
              <Input placeholder="usuario" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input placeholder="tu@email.com" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Contrasena"
              rules={[
                { required: true, min: 12 },
                { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, message: "Mayuscula, minuscula y numero" },
              ]}
            >
              <Input.Password placeholder="Min. 12 caracteres" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" style={{ marginTop: 8 }}>
              Registrarme
            </Button>
          </Form>
          <Typography.Paragraph style={{ marginTop: 20, marginBottom: 0, textAlign: "center" }}>
            Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
          </Typography.Paragraph>
        </Card>
      </div>
    </div>
  );
}
