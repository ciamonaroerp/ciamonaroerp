import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  Boxes,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Zap,
  ScrollText,
  Server,
  Rocket,
  LogOut,
  ShieldX,
  Database,
  Layers,
  AlertCircle,
  Calculator,
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmpresaProvider } from "@/components/context/EmpresaContext";
import { useSupabaseAuth, clearSupabaseSession } from "@/components/context/SupabaseAuthContext";
import { supabase } from "@/components/lib/supabaseClient";
import { ErpHeader } from "@/components/design-system";
import SystemVersion from "@/components/system/SystemVersion";


// Seções fixas que não são módulos configuráveis
const SECTION_PRINCIPAL = {
  label: "Principal",
  items: [
    { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
    { name: "Deploy Manager", page: "DeployManager", icon: Rocket },
  ],
};

const SECTION_ERP = {
  label: "ERP",
  items: [
    { name: "Módulos do ERP", page: "ModulosPage", icon: Boxes },
    { name: "Fiscal", page: "FiscalPage", icon: ScrollText },
    { name: "Histórico de Preços", page: "HistoricoPrecosPage", icon: BarChart3 },
  ],
};

const SECTION_CADASTROS = {
  label: "Cadastros",
  items: [
    { name: "Usuários", page: "Usuarios", icon: Users },
    { name: "Informações", page: "InformacoesPage", icon: ScrollText },
    { name: "Clientes", page: "ClientesPage", icon: Building2 },
    { name: "Transportadoras", page: "Transportadoras", icon: Building2 },
    { name: "Modalidade de Frete", page: "ModalidadeFrete", icon: Package },
    { name: "Fornecedores", page: "FornecedoresPage", icon: Building2 },
  ],
};

const SECTION_SISTEMA = {
  label: "Sistema",
  items: [
    { name: "Configurações da Empresa", page: "EmpresasConfigPage", icon: Settings },
    { name: "Integrações", page: "IntegracoesERP", icon: Zap },
    { name: "Logs de Auditoria", page: "LogsAuditoria", icon: ScrollText },
    { name: "Logs do Sistema", page: "SistemaLogsPage", icon: AlertCircle },
  ],
};

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuSections, setMenuSections] = useState([]);
  const [menuCarregado, setMenuCarregado] = useState(false);
  const [expandedSections, setExpandedSections] = useState([]);

  // Lê permissões e session diretamente do SupabaseAuthContext (já carregado com JWT)
  const { ready: supabaseReady, session, erpUsuario } = useSupabaseAuth();

  // Deriva nome do usuário da session e erpUsuario
  const userName = erpUsuario?.nome || session?.user?.email || "Usuário";
  const userPerfil = erpUsuario?.perfil ?? null;

  function normalizarPermissoes(lista) {
    if (!lista || !Array.isArray(lista)) return [];
    return lista.map(item => String(item).toLowerCase().trim());
  }

  const isAdmin = erpUsuario?.perfil === "Administrador";
  const temErpUsuario = supabaseReady && erpUsuario !== null;

  const modulosAutorizados = !temErpUsuario ? [] : (isAdmin ? "*" : normalizarPermissoes(erpUsuario.modulos_autorizados));
  const cadastrosAutorizados = !temErpUsuario ? [] : (isAdmin ? "*" : normalizarPermissoes(erpUsuario.cadastros_autorizados));
  const sistemaAutorizado = !temErpUsuario ? [] : (isAdmin ? "*" : normalizarPermissoes(erpUsuario.sistema_autorizado));

  // Detecta tokens de convite Supabase na URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token") || hash.includes("type=invite")) {
      if (supabase) {
        supabase.auth.getSession().then(({ data }) => {
          if (data?.session) {
            window.location.href = createPageUrl("Dashboard");
          }
        });
      }
    }
  }, []);

  // Carrega módulos e suas páginas configuradas via Supabase
  useEffect(() => {
    if (!supabaseReady) return;

    const carregarMenu = async () => {
      try {
        if (supabase) {
          // Busca TODOS os módulos cadastrados, ordenados por ordem_modulo
          const { data: modulos } = await supabase
            .from('modulos_erp')
            .select('id,nome_modulo,empresa_id')
            .order('ordem_modulo', { ascending: true });

          // Deduplica por nome_modulo (caso haja duplicatas no banco)
          const vistos = new Set();
          const modulosUnicos = (modulos || []).filter(m => {
            if (!m.nome_modulo || vistos.has(m.nome_modulo)) return false;
            vistos.add(m.nome_modulo);
            return true;
          });

          let paginasPorModulo = {};

          if (modulosUnicos.length > 0) {
            const empresa_id = modulosUnicos[0]?.empresa_id;
            if (empresa_id) {
              const { data: paginas } = await supabase
                .from('modulo_paginas')
                .select('modulo_nome,pagina_nome,label_menu,ordem')
                .eq('empresa_id', empresa_id)
                .order('ordem', { ascending: true });

              (paginas || []).forEach(p => {
                if (!paginasPorModulo[p.modulo_nome]) paginasPorModulo[p.modulo_nome] = [];
                // Deduplica por pagina_nome dentro do mesmo módulo
                if (!paginasPorModulo[p.modulo_nome].some(x => x.pagina_nome === p.pagina_nome)) {
                  paginasPorModulo[p.modulo_nome].push(p);
                }
              });
            }
          }

          // Monta seções: apenas módulos que têm páginas vinculadas aparecem no menu
          const secoesDinamicas = modulosUnicos
            .map(m => {
              const paginas = paginasPorModulo[m.nome_modulo] || [];
              if (paginas.length === 0) return null;
              return {
                label: m.nome_modulo,
                isModulo: true,
                items: paginas.map(p => ({
                  name: p.label_menu || p.pagina_nome,
                  page: p.pagina_nome,
                  icon: Layers,
                  modulo: m.nome_modulo,
                })),
              };
            })
            .filter(Boolean);

          const sections = [
            SECTION_PRINCIPAL,
            SECTION_ERP,
            ...secoesDinamicas,
            SECTION_CADASTROS,
            SECTION_SISTEMA,
          ];
          setMenuSections(sections);
          setExpandedSections(sections.map(() => false));
        } else {
          const fallback = [SECTION_PRINCIPAL, SECTION_ERP, SECTION_CADASTROS, SECTION_SISTEMA];
          setMenuSections(fallback);
          setExpandedSections(fallback.map(() => false));
        }
      } catch (err) {
        console.warn('[Layout] Erro ao carregar menu, usando estático:', err.message);
        const fallback = [SECTION_PRINCIPAL, SECTION_ERP, SECTION_CADASTROS, SECTION_SISTEMA];
        setMenuSections(fallback);
        setExpandedSections(fallback.map(() => false));
      } finally {
        setMenuCarregado(true);
      }
    };

    carregarMenu();

    window.addEventListener('erp-menu-atualizado', carregarMenu);
    return () => window.removeEventListener('erp-menu-atualizado', carregarMenu);
  }, [supabaseReady]);

  const handleLogout = async () => {
    await clearSupabaseSession();
    window.location.href = "/";
  };

  // Comportamento acordeão: abre clicado, fecha todos os outros
  const toggleSection = idx =>
    setExpandedSections(prev => prev.map((v, i) => (i === idx ? !v : false)));

  const temAcesso = (item, secao) => {
    if (!item) return true;
    const chave = String(item).toLowerCase().trim();
    const lista = secao === "modulo" ? modulosAutorizados
      : secao === "cadastro" ? cadastrosAutorizados
      : sistemaAutorizado;
    if (lista === "*") return true;
    if (!Array.isArray(lista)) return false;
    return lista.includes(chave);
  };

  const itemAtual = menuSections.flatMap(s => s.items).find(i => i.page === currentPageName);
  let paginaBloqueada = false;
  if (modulosAutorizados !== null && itemAtual) {
    const section = menuSections.find(s => s.items.includes(itemAtual));
    if (section?.label === "Principal" || section?.label === "Cadastros") {
      paginaBloqueada = !temAcesso(itemAtual.name, "cadastro");
    } else if (section?.label === "Sistema") {
      paginaBloqueada = !temAcesso(itemAtual.name, "sistema");
    } else if (itemAtual?.modulo) {
      paginaBloqueada = !temAcesso(itemAtual.modulo, "modulo");
    }
  }

  // Loading: aguarda contexto Supabase estar pronto
  if (!supabaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F7FB' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center animate-pulse" style={{ background: '#3B5CCC' }}>
            <Zap className="h-5 w-5 text-white" />
          </div>
          <p className="text-sm" style={{ color: '#6B7280' }}>Inicializando sessão…</p>
        </div>
      </div>
    );
  }

  return (
    <EmpresaProvider>
      <div className="min-h-screen flex" style={{ background: '#F5F7FB' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          :root { --sidebar-width: 272px; }
          * { font-family: 'Inter', system-ui, sans-serif; }
          @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
          .sidebar-animate { animation: slideIn 0.2s ease-out; }
        `}</style>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed top-0 left-0 h-full z-50 flex flex-col text-white w-[272px] shadow-2xl",
            "lg:translate-x-0 transition-transform duration-200",
            sidebarOpen ? "translate-x-0 sidebar-animate" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <div className="px-6 py-5 border-b border-white/10 shrink-0" style={{ background: '#3B5CCC' }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">CIAMONARO ERP</h1>
                <p className="text-[11px] text-blue-100/70 font-medium tracking-wider uppercase">ERP Master v1.0</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-5 right-4 lg:hidden text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1" style={{ background: '#3B5CCC', visibility: menuCarregado ? 'visible' : 'hidden' }}>
            <style>{`
              .menu-section-content {
                overflow: hidden;
                transition: all 0.25s ease-in-out;
              }
              .menu-section-content[data-expanded="true"] {
                opacity: 1;
              }
              .menu-section-content[data-expanded="false"] {
                opacity: 0;
                max-height: 0;
              }
            `}</style>
            {menuSections.map((section, sIdx) => {
              let itensFiltrados = [];
              if (section.isModulo) {
                // Seção dinâmica de módulo: verifica acesso ao módulo e exibe todas as páginas
                if (!temAcesso(section.label, "modulo")) {
                  itensFiltrados = [];
                } else {
                  itensFiltrados = section.items;
                }
              } else if (section.label === "Principal" || section.label === "ERP") {
                itensFiltrados = section.items; // sempre visível
              } else if (section.label === "Cadastros") {
                itensFiltrados = section.items.filter(item => temAcesso(item.name, "cadastro"));
              } else if (section.label === "Sistema") {
                itensFiltrados = section.items.filter(item => temAcesso(item.name, "sistema"));
              } else {
                itensFiltrados = section.items;
              }
              if (itensFiltrados.length === 0) return null;
              return (
                <div key={section.label} className="mb-1">
                  <button
                    onClick={() => toggleSection(sIdx)}
                    className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-blue-100/60 hover:text-white transition-colors duration-200"
                  >
                    {section.label}
                    <ChevronRight className={cn("h-3 w-3 transition-transform duration-250", expandedSections[sIdx] && "rotate-90")} />
                  </button>
                  <div className="menu-section-content" data-expanded={expandedSections[sIdx]}>
                    <div className="space-y-0.5">
                      {itensFiltrados.map(item => {
                         const isActive = currentPageName === item.page;
                         return (
                           <Link
                             key={item.page}
                             to={createPageUrl(item.page)}
                             onClick={() => setSidebarOpen(false)}
                             className={cn(
                               "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                               isActive ? "bg-white/20 text-white" : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                             )}
                           >
                             <item.icon className={cn("h-[17px] w-[17px] shrink-0", isActive ? "text-white" : "text-blue-200/60")} />
                             <span className="truncate">{item.name}</span>
                             {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white shrink-0" />}
                           </Link>
                         );
                       })}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="px-5 py-3 border-t border-white/10 shrink-0" style={{ background: '#3B5CCC' }}>
            <p className="text-[10px] text-blue-100/50 text-center flex items-center justify-center gap-1">
            <SystemVersion />
            <span className="opacity-40">• SaaS Multiempresa</span>
          </p>
          </div>
        </aside>

        <div className="flex-1 lg:ml-[272px] min-h-screen flex flex-col">
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 lg:hidden px-4 py-3 flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1" />
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <ErpHeader
            title={currentPageName ? currentPageName.replace(/([A-Z])/g, " $1").trim() : "Dashboard"}
            notifications={0}
            userName={userName}
            userPerfil={userPerfil}
            onLogout={handleLogout}
          />

          <main className="flex-1 p-4 lg:p-8" style={{ background: '#F5F7FB' }}>
            {paginaBloqueada ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center">
                  <ShieldX className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Acesso não autorizado a este módulo.</h2>
                <p className="text-slate-500 text-sm max-w-sm">
                  Você não tem permissão para acessar esta página. Contate o administrador do sistema.
                </p>
                <Link
                  to={createPageUrl("Dashboard")}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Voltar ao Dashboard
                </Link>
              </div>
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </EmpresaProvider>
  );
}