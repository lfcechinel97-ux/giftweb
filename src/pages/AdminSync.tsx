import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface SyncLog {
  id: string;
  synced_at: string;
  total_products: number;
  status: string;
  erro: string | null;
}

export default function AdminSync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; total?: number; error?: string } | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from("sync_log")
      .select("*")
      .order("synced_at", { ascending: false })
      .limit(10);
    if (!error && data) setLogs(data as SyncLog[]);
    setLogsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-products", {
        method: "POST",
      });
      if (error) {
        setResult({ success: false, error: error.message });
      } else {
        setResult(data as { success: boolean; total?: number; error?: string });
      }
      await fetchLogs();
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Admin — Sincronização de Produtos</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Executar Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSync} disabled={loading} size="lg">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Sincronizando..." : "Executar Sync Agora"}
            </Button>

            {result && (
              <div
                className={`p-4 rounded-md border ${
                  result.success
                    ? "bg-green-50 border-green-200 text-green-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {result.success ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Sync concluído com sucesso! {result.total} produtos sincronizados.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    <span>Erro: {result.error}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos 10 Syncs</CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground">Nenhum registro de sync encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Produtos</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {new Date(log.synced_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4" /> Sucesso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <XCircle className="h-4 w-4" /> Erro
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{log.total_products}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {log.erro || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
