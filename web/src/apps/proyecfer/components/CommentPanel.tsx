import { Button, Card, Input, List, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { createComment, fetchComments } from "../../../api/proyecfer";
import type { CommentItem } from "../../../types/proyecfer";

type Props = {
  targetType: "COLLAB_TASK" | "COLLAB_PROJECT" | "PAGE" | "WORK_GUIDE";
  targetId: string;
};

export function CommentPanel({ targetType, targetId }: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setComments(await fetchComments(targetType, targetId));
    } catch {
      message.error("No se pudieron cargar comentarios");
    }
  }, [targetType, targetId]);

  useEffect(() => { void load(); }, [load]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setLoading(true);
    try {
      await createComment({ targetType, targetId, body: body.trim() });
      setBody("");
      await load();
    } catch {
      message.error("No se pudo enviar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Comentarios" size="small" className="panel-card">
      <List
        size="small"
        dataSource={comments}
        locale={{ emptyText: "Sin comentarios" }}
        renderItem={(c) => (
          <List.Item>
            <div>
              <Typography.Text strong>{c.author.fullName}</Typography.Text>
              <Typography.Paragraph style={{ margin: "4px 0 0" }}>{c.body}</Typography.Paragraph>
              {c.replies?.map((r) => (
                <div key={r.id} style={{ marginLeft: 16, marginTop: 8, paddingLeft: 12, borderLeft: "2px solid #334155" }}>
                  <Typography.Text strong>{r.author.fullName}</Typography.Text>
                  <div>{r.body}</div>
                </div>
              ))}
            </div>
          </List.Item>
        )}
      />
      <Input.TextArea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe un comentario..." style={{ marginTop: 8 }} />
      <Button type="primary" block loading={loading} onClick={() => void handleSend()} style={{ marginTop: 8 }}>
        Comentar
      </Button>
    </Card>
  );
}
