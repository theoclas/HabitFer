import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";

type Props = {
  to: string;
  label?: string;
  className?: string;
};

export function BackButton({ to, label = "Volver", className }: Props) {
  const navigate = useNavigate();
  return (
    <Button
      type="text"
      icon={<ArrowLeftOutlined />}
      onClick={() => navigate(to)}
      className={className ? `page-back-btn ${className}` : "page-back-btn"}
    >
      {label}
    </Button>
  );
}
