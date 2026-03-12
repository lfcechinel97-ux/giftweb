import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle2, XCircle, ArrowLeft, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";

interface SyncLog {
  id: string;
  synced_at: string;
  total_products: number;
  status: string;
  erro: string | null;
}

interface MockResult {
  codigo: string;
  is_variante: boolean | null;
  produto_pai: string | null;
}

export default function AdminSync() {
  const [loading, setLoading] = useState(false);
  const [mockLoading, setMockLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; total?: number; error?: string; mock?: boolean } | null>(null);
  const [mockResults, setMockResults] = useState<MockResult[] | null>(null);
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
    setMockResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-products");
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

  const handleMockSync = async () => {
    setMockLoading(true);
    setResult(null);
    setMockResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-products", {
        body: { mock: true },
      });
      if (error) {
        setResult({ success: false, error: error.message });
      } else {
        setResult(data as { success: boolean; total?: number; error?: string; mock?: boolean });

        // Fetch the 5 mock products to verify grouping
        const mockCodes = ["9139A-AZU", "9139A-VRM", "9139A-PRE", "00033-4GB", "17011C"];
        const { data: rows } = await supabase
          .from("products_cache")
          .select("codigo_amigavel, is_variante, produto_pai")
          .in("codigo_amigavel", mockCodes);
        if (rows) {
          setMockResults(
            rows.map((r) => ({
              codigo: r.codigo_amigavel,
              is_variante: r.is_variante,
              produto_pai: r.produto_pai,
            }))
          );
        }
      }
      await fetchLogs();
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setMockLoading(false);
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
            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleSync} disabled={loading || mockLoading} size="lg">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Sincronizando..." : "Executar Sync Agora"}
              </Button>
              <Button onClick={handleMockSync} disabled={loading || mockLoading} size="lg" variant="outline">
                <FlaskConical className={`mr-2 h-4 w-4 ${mockLoading ? "animate-spin" : ""}`} />
                {mockLoading ? "Testando..." : "Testar Sync (mock)"}
              </Button>
            </div>

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
                    <span>
                      {result.mock ? "Mock sync" : "Sync"} concluído com sucesso! {result.total} produtos sincronizados.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5" />
                    <span>Erro: {result.error}</span>
                  </div>
                )}
              </div>
            )}

            {mockResults && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Verificação Mock — Agrupamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>is_variante</TableHead>
                        <TableHead>produto_pai</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mockResults.map((r) => {
                        const expected: Record<string, { variante: boolean; temPai: boolean }> = {
                          "9139A-AZU": { variante: false, temPai: false },
                          "9139A-VRM": { variante: true, temPai: true },
                          "9139A-PRE": { variante: true, temPai: true },
                          "00033-4GB": { variante: false, temPai: false },
                          "17011C": { variante: false, temPai: false },
                        };
                        const exp = expected[r.codigo];
                        const ok =
                          exp &&
                          r.is_variante === exp.variante &&
                          (exp.temPai ? !!r.produto_pai : !r.produto_pai);
                        return (
                          <TableRow key={r.codigo}>
                            <TableCell className="font-mono">{r.codigo}</TableCell>
                            <TableCell>{String(r.is_variante)}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.produto_pai ? r.produto_pai.slice(0, 8) + "…" : "null"}
                            </TableCell>
                            <TableCell>
                              {ok ? (
                                <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                  <CheckCircle2 className="h-4 w-4" /> OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                  <XCircle className="h-4 w-4" /> FALHA
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
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
                        {log.status === "success" || log.status === "success-mock" ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4" /> {log.status === "success-mock" ? "Mock OK" : "Sucesso"}
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
