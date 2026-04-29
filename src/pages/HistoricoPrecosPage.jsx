import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Download, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '@/components/lib/supabaseClient';
import { useEmpresa } from '@/components/context/EmpresaContext';

const ITEMS_PER_PAGE = 50;

export default function HistoricoPrecosPage() {
  const { empresa_id } = useEmpresa();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [selectedFornecedor, setSelectedFornecedor] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Buscar dados da tabela historico_precos_produto_erp
  const { data: allData = [], isLoading, error } = useQuery({
    queryKey: ['historico_precos', empresa_id],
    queryFn: async () => {
      let q = supabase.from('historico_precos_produto_erp').select('*');
      if (empresa_id) q = q.eq('empresa_id', empresa_id);
      const { data } = await q.order('data_emissao', { ascending: false });
      return data || [];
    },
    enabled: true,
  });

  // Calcular variação de preço
  const dataComVariacao = useMemo(() => {
    if (!allData || allData.length === 0) return [];

    // Agrupar por codigo_produto para calcular variação
    const grouped = {};
    allData.forEach(item => {
      const key = item.codigo_produto || item.codigo_unico || 'sem-codigo';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    // Ordenar cada grupo por data (mais antigos primeiro)
    Object.values(grouped).forEach(arr => {
      arr.sort((a, b) => new Date(a.data_emissao) - new Date(b.data_emissao));
    });

    // Calcular variação
    const resultado = [];
    Object.entries(grouped).forEach(([_, items]) => {
      items.forEach((item, idx) => {
        const itemAnterior = idx > 0 ? items[idx - 1] : null;
        let variacao = null;
        let percentual = null;

        if (itemAnterior && itemAnterior.valor_unitario && item.valor_unitario) {
          variacao = item.valor_unitario - itemAnterior.valor_unitario;
          percentual = ((variacao / itemAnterior.valor_unitario) * 100).toFixed(2);
        }

        // Extrair descricao_base e descricao_complementar do dados_danfe se não estiverem na raiz
        const danfe = typeof item.dados_danfe === 'string' ? JSON.parse(item.dados_danfe || '{}') : (item.dados_danfe || {});
        resultado.push({
          ...item,
          descricao_base: item.descricao_base || danfe.descricao_base || null,
          descricao_complementar: item.descricao_complementar || danfe.descricao_complementar || null,
          variacao,
          percentual,
          tipoVariacao: variacao ? (variacao > 0 ? 'aumento' : 'queda') : null,
        });
      });
    });

    return resultado;
  }, [allData]);

  // Aplicar filtros
  const dataFiltrada = useMemo(() => {
    return dataComVariacao.filter(item => {
      const txt = searchText.toLowerCase();
      const matchSearch = !searchText ||
        (item.codigo_unico && item.codigo_unico.toLowerCase().includes(txt)) ||
        (item.codigo_produto && item.codigo_produto.toLowerCase().includes(txt)) ||
        (item.descricao_base && item.descricao_base.toLowerCase().includes(txt)) ||
        (item.descricao_complementar && item.descricao_complementar.toLowerCase().includes(txt));

      const matchFornecedor = !selectedFornecedor || item.fornecedor_nome === selectedFornecedor;

      const matchData = (!dataInicio && !dataFim) || (
        (!dataInicio || new Date(item.data_emissao) >= new Date(dataInicio)) &&
        (!dataFim || new Date(item.data_emissao) <= new Date(dataFim))
      );

      return matchSearch && matchFornecedor && matchData;
    }).sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
  }, [dataComVariacao, searchText, selectedFornecedor, dataInicio, dataFim]);

  // Paginação
  const totalPages = Math.ceil(dataFiltrada.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const dataPaginada = dataFiltrada.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // Lista única de fornecedores
  const fornecedores = useMemo(() => {
    return [...new Set(allData.filter(d => d.fornecedor_nome).map(d => d.fornecedor_nome))];
  }, [allData]);

  // Exportar CSV
  const exportarCSV = () => {
    const headers = ['Código Único', 'Fornecedor', 'Descrição Base', 'Descrição Complementar', 'Data', 'Valor Unitário', 'Variação %'];
    const rows = dataFiltrada.map(item => [
      item.codigo_unico || item.codigo_produto || '',
      item.fornecedor_nome || '',
      item.descricao_base || '',
      item.descricao_complementar || '',
      item.data_emissao ? new Date(item.data_emissao).toLocaleDateString('pt-BR') : '',
      item.valor_unitario?.toFixed(2) || '',
      item.percentual || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historico-precos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico de Preços</h1>
        <p className="text-slate-600 mt-2">Consulta de variação de preços por item com base nas notas fiscais importadas</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Buscar</label>
              <Input
                placeholder="Código, descrição..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Fornecedor</label>
              <Select value={selectedFornecedor} onValueChange={(val) => { setSelectedFornecedor(val === '__todos__' ? '' : val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {fornecedores.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Data Início</label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Data Fim</label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => { setDataFim(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <p className="text-sm text-slate-600">
              {dataFiltrada.length} registro{dataFiltrada.length !== 1 ? 's' : ''} encontrado{dataFiltrada.length !== 1 ? 's' : ''}
            </p>
            <Button onClick={exportarCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar histórico
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Carregando dados...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">Erro ao carregar dados</div>
          ) : dataPaginada.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nenhum registro encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="py-2 text-xs">Código Único</TableHead>
                    <TableHead className="py-2 text-xs">Fornecedor</TableHead>
                    <TableHead className="py-2 text-xs">Descrição Base</TableHead>
                    <TableHead className="py-2 text-xs">Descrição Complementar</TableHead>
                    <TableHead className="py-2 text-xs">Data</TableHead>
                    <TableHead className="py-2 text-xs text-right">Valor Unitário</TableHead>
                    <TableHead className="py-2 text-xs text-center">Variação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataPaginada.map((item, idx) => (
                    <TableRow key={item.id || idx} className="hover:bg-slate-50">
                      <TableCell className="py-1.5 font-mono text-[11px] whitespace-nowrap">
                        {item.codigo_unico
                          ? <span className="text-slate-900 font-medium">{item.codigo_unico}</span>
                          : <span className="text-red-600 font-medium" title="Sem vínculo cadastrado">{item.codigo_produto || '-'}</span>
                        }
                      </TableCell>
                      <TableCell className="py-1.5 text-slate-700 text-[11px] max-w-[160px] truncate whitespace-nowrap" title={item.fornecedor_nome}>{item.fornecedor_nome || '-'}</TableCell>
                      <TableCell className="py-1.5 text-slate-700 text-[11px] max-w-[180px] truncate whitespace-nowrap" title={item.descricao_base}>{item.descricao_base || '-'}</TableCell>
                      <TableCell className="py-1.5 text-slate-700 text-[11px] max-w-[180px] truncate whitespace-nowrap" title={item.descricao_complementar}>{item.descricao_complementar || '-'}</TableCell>
                      <TableCell className="py-1.5 text-slate-700 text-[11px] whitespace-nowrap">
                        {item.data_emissao ? new Date(item.data_emissao).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-[11px] whitespace-nowrap">
                        {item.valor_unitario != null ? `R$ ${Number(item.valor_unitario).toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="py-1.5 text-center whitespace-nowrap">
                        {item.tipoVariacao === 'aumento' ? (
                          <div className="flex items-center justify-center gap-1 text-red-600">
                            <TrendingUp className="w-3 h-3" />
                            <span className="text-[11px] font-medium">{item.percentual}%</span>
                          </div>
                        ) : item.tipoVariacao === 'queda' ? (
                          <div className="flex items-center justify-center gap-1 text-green-600">
                            <TrendingDown className="w-3 h-3" />
                            <span className="text-[11px] font-medium">{Math.abs(item.percentual)}%</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination>
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious onClick={() => setCurrentPage(currentPage - 1)} className="cursor-pointer" />
                </PaginationItem>
              )}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={currentPage === pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext onClick={() => setCurrentPage(currentPage + 1)} className="cursor-pointer" />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}