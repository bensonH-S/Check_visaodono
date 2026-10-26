import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import {
  api,
  type Cargo,
  type PermissaoCatalogo,
  type TipoChecklist,
} from '../../api/client';
import {
  Aviso,
  Barra,
  Erro,
  PainelLateral,
  Resumo,
  Resumos,
  Secao,
  Selo,
  TabelaConfig,
  Titulo,
  type Coluna,
} from '../../financeiro/components/ConfigUi';
import { PrefsProvider } from '../../financeiro/prefs';
import { finCampoSx, FIN_BORDER, FIN_MUTED, FIN_SURFACE_ALT, FIN_TEXT } from '../../financeiro/temaFinanceiroEscuro';
import { configPageSx } from './configPageSx';

/** Agrupa o catálogo em “o que aparece no menu” + ações. */
const MENUS_SISTEMA: { titulo: string; descricao: string; codigos: string[] }[] = [
  {
    titulo: 'Command Center',
    descricao: 'Dashboard, ranking, NCs e resumo de gastos',
    codigos: ['portal.dashboard.ver', 'financeiro.resumo.ver'],
  },
  {
    titulo: 'Financeiro',
    descricao: 'Inbox, agenda, conciliação e caixa',
    codigos: ['financeiro.ver'],
  },
  {
    titulo: 'AutoREV / Checklist',
    descricao: 'Acesso e execução em loja',
    codigos: ['checklist.ver', 'checklist.executar'],
  },
  {
    titulo: 'Chamados de manutenção',
    descricao: 'Ver, abrir, assumir e aprovar',
    codigos: ['chamados.ver', 'chamados.abrir', 'chamados.assumir', 'chamados.aprovar'],
  },
  {
    titulo: 'Energia',
    descricao: 'Ocorrências e protocolos',
    codigos: ['energia.ver', 'energia.abrir'],
  },
  {
    titulo: 'Frota',
    descricao: 'Veículos, mapa e débitos',
    codigos: [
      'frota.usar',
      'frota.mapa.ver',
      'frota.gerenciar',
      'frota.regioes',
      'frota.multas.sync',
      'frota.debitos.ver',
      'frota.debitos.sync',
    ],
  },
  {
    titulo: 'Escalas / Planejamento',
    descricao: 'Escala de visitas e gestores',
    codigos: [
      'escalas.visitas.ver',
      'escalas.visitas.gerenciar',
      'escalas.visitas.editar_regiao',
      'escalas.visitas.editar_delivery',
    ],
  },
  {
    titulo: 'Visitas',
    descricao: 'Histórico e gestão de relatórios',
    codigos: ['portal.visitas.ver', 'portal.visitas.apagar', 'portal.visitas.reabrir'],
  },
  {
    titulo: 'Estoque & CMV',
    descricao: 'Insumos, contagem e operacional',
    codigos: [
      'estoque.produtos',
      'estoque.conferencia',
      'estoque.conferencia.reabrir',
      'estoque.operacional',
      'estoque.break',
    ],
  },
  {
    titulo: 'Metas',
    descricao: 'Indicadores e metas',
    codigos: ['metas.ver', 'metas.gerenciar'],
  },
  {
    titulo: 'Tickets TI',
    descricao: 'Abrir e gerenciar board de TI',
    codigos: ['ti.tickets.abrir', 'ti.tickets.gerenciar'],
  },
  {
    titulo: 'Escopo de lojas',
    descricao: 'Rede inteira (Igor etc.). Sem isso, supervisor só vê a região vinculada no cadastro do usuário.',
    codigos: ['lojas.todas'],
  },
  {
    titulo: 'Configurações',
    descricao: 'Cadastros, auditoria e canais',
    codigos: [
      'configuracoes.ver',
      'configuracoes.perguntas',
      'configuracoes.notificacoes',
      'configuracoes.auditoria',
      'portal.lojas.ver',
      'usuarios.listar',
      'usuarios.gerenciar',
      'sistema.backup',
    ],
  },
  {
    titulo: 'Não conformidades',
    descricao: 'Ver e resolver NCs',
    codigos: ['ncs.ver', 'ncs.resolver'],
  },
  {
    titulo: 'Freelancers',
    descricao: 'Aprovar turnos',
    codigos: ['freelancers.aprovar'],
  },
];

type FormCargo = {
  nome: string;
  descricao: string;
  aprovador: boolean;
  ativo: boolean;
  tipos_checklist: string[];
  permissoes: string[];
};

const emptyForm: FormCargo = {
  nome: '',
  descricao: '',
  aprovador: false,
  ativo: true,
  tipos_checklist: [],
  permissoes: [],
};

export default function CargosPage() {
  const [lista, setLista] = useState<Cargo[]>([]);
  const [catalogo, setCatalogo] = useState<PermissaoCatalogo[]>([]);
  const [tiposCatalogo, setTiposCatalogo] = useState<TipoChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Cargo | null>(null);
  const [form, setForm] = useState<FormCargo>(emptyForm);
  const [novo, setNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!opts?.silencioso) setLoading(true);
    setErro('');
    try {
      const [cargos, tipos, cat] = await Promise.all([
        api.cargosGestao(),
        api.checklistTiposCatalogo(),
        api.permissoesCatalogo(),
      ]);
      setLista(cargos);
      setTiposCatalogo(tipos);
      setCatalogo(cat);
      return cargos;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
      return null;
    } finally {
      if (!opts?.silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        (c.descricao || '').toLowerCase().includes(q),
    );
  }, [lista, busca]);

  const mapaNome = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of catalogo) m.set(p.codigo, p.nome);
    return m;
  }, [catalogo]);

  function abrirNovo() {
    setNovo(true);
    setSelecionado(null);
    setForm(emptyForm);
    setErro('');
    setOk('');
  }

  function abrirEditar(cargo: Cargo) {
    setNovo(false);
    setSelecionado(cargo);
    const ativos = new Set(tiposCatalogo.map((t) => t.codigo));
    setForm({
      nome: cargo.nome,
      descricao: cargo.descricao || '',
      aprovador: !!cargo.aprovador,
      ativo: cargo.ativo !== false,
      tipos_checklist: (cargo.tipos_checklist || []).map((t) => t.codigo).filter((c) => ativos.has(c)),
      permissoes: [...(cargo.permissoes || [])],
    });
    setErro('');
    setOk('');
  }

  function togglePerm(codigo: string) {
    setForm((f) => {
      const tem = f.permissoes.includes(codigo);
      return {
        ...f,
        permissoes: tem ? f.permissoes.filter((c) => c !== codigo) : [...f.permissoes, codigo],
      };
    });
  }

  function marcarGrupo(codigos: string[], ligar: boolean) {
    setForm((f) => {
      const set = new Set(f.permissoes);
      for (const c of codigos) {
        if (ligar) set.add(c);
        else set.delete(c);
      }
      return { ...f, permissoes: [...set] };
    });
  }

  async function salvar() {
    if (!form.nome.trim()) {
      setErro('Informe o nome do perfil.');
      setOk('');
      return;
    }
    setSalvando(true);
    setErro('');
    setOk('');
    try {
      const ativos = new Set(tiposCatalogo.map((t) => t.codigo));
      const body = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        aprovador: form.aprovador,
        ativo: form.ativo,
        tipos_checklist: form.tipos_checklist.filter((c) => ativos.has(c)),
        permissoes: form.permissoes,
      };
      const salvo = selecionado
        ? await api.cargoGestaoAtualizar(selecionado.id_cargo, body)
        : await api.cargoGestaoCriar(body);
      setNovo(false);
      setSelecionado(salvo);
      setForm({
        nome: salvo.nome,
        descricao: salvo.descricao || '',
        aprovador: !!salvo.aprovador,
        ativo: salvo.ativo !== false,
        tipos_checklist: (salvo.tipos_checklist || []).map((t) => t.codigo),
        permissoes: [...(salvo.permissoes || [])],
      });
      setOk('Perfil salvo.');
      void carregar({ silencioso: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!selecionado) return;
    if (!window.confirm(`Excluir o perfil “${selecionado.nome}”?`)) return;
    try {
      await api.cargoGestaoExcluir(selecionado.id_cargo);
      setSelecionado(null);
      setNovo(false);
      setForm(emptyForm);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  }

  const colunas: Coluna<Cargo>[] = [
    {
      titulo: 'Perfil',
      render: (c) => (
        <Box>
          <Typography sx={{ fontWeight: 650, fontSize: 13 }}>{c.nome}</Typography>
          <Typography sx={{ fontSize: 11, color: FIN_MUTED }}>{c.codigo}</Typography>
        </Box>
      ),
    },
    {
      titulo: 'Acessos',
      largura: 100,
      render: (c) => (
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{(c.permissoes || []).length}</Typography>
      ),
    },
    {
      titulo: 'Status',
      largura: 110,
      render: (c) => (
        <Selo
          texto={c.ativo === false ? 'Inativo' : c.aprovador ? 'Aprovador' : 'Ativo'}
          tom={c.ativo === false ? 'neutro' : c.aprovador ? 'info' : 'ok'}
        />
      ),
    },
  ];

  const painelAberto = novo || Boolean(selecionado);
  const ativos = lista.filter((c) => c.ativo !== false).length;

  const outrosCodigos = useMemo(() => {
    const usados = new Set(MENUS_SISTEMA.flatMap((m) => m.codigos));
    return catalogo.filter((p) => !usados.has(p.codigo));
  }, [catalogo]);

  return (
    <PrefsProvider>
      <Box sx={configPageSx}>
        <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Titulo
          texto="Permissões por perfil"
          sub="Defina o que cada perfil vê no menu e pode fazer. No usuário basta escolher o perfil."
        />

        <Resumos>
          <Resumo rotulo="Perfis" valor={String(lista.length)} detalhe={`${ativos} ativos`} />
          <Resumo
            rotulo="Com acesso"
            valor={String(lista.filter((c) => (c.permissoes || []).length > 0).length)}
            detalhe="com telas liberadas"
          />
          <Resumo
            rotulo="Aprovadores"
            valor={String(lista.filter((c) => c.aprovador).length)}
            detalhe="orçamentos"
          />
        </Resumos>

        <Barra busca={busca} onBusca={setBusca} placeholder="Buscar perfil…">
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={abrirNovo}>
            Novo perfil
          </Button>
        </Barra>

        {!painelAberto ? <Erro erro={erro} /> : null}
        <Aviso texto={ok} onFechar={() => setOk('')} />

        <TabelaConfig
          colunas={colunas}
          linhas={loading ? [] : filtrados}
          chave={(c) => String(c.id_cargo)}
          vazio={loading ? 'Carregando…' : 'Nenhum perfil cadastrado.'}
          onLinha={(c) => abrirEditar(c)}
        />

        <PainelLateral
          aberto={painelAberto}
          largura={520}
          titulo={novo ? 'Novo perfil' : selecionado?.nome || 'Perfil'}
          subtitulo="Menus, ações e checklists deste perfil"
          onFechar={() => {
            setSelecionado(null);
            setNovo(false);
            setOk('');
          }}
          rodape={
            <>
              {selecionado ? (
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  disabled={salvando}
                  onClick={() => void excluir()}
                >
                  Excluir
                </Button>
              ) : (
                <Box sx={{ flex: 1 }} />
              )}
              <Box sx={{ flex: 1 }} />
              <Button size="small" disabled={salvando} onClick={() => { setSelecionado(null); setNovo(false); setOk(''); }}>
                Fechar
              </Button>
              <Button size="small" variant="contained" disabled={salvando} onClick={() => void salvar()}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
            </>
          }
        >
              {erro ? (
                <Alert severity="error" onClose={() => setErro('')} sx={{ mb: 1.5 }}>
                  {erro}
                </Alert>
              ) : null}
              {ok ? (
                <Alert severity="success" onClose={() => setOk('')} sx={{ mb: 1.5 }}>
                  {ok}
                </Alert>
              ) : null}
              <Secao titulo="Dados">
                <Stack spacing={1.25}>
                  <TextField
                    size="small"
                    label="Nome do perfil"
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    sx={finCampoSx}
                  />
                  <TextField
                    size="small"
                    label="Descrição"
                    multiline
                    minRows={2}
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex.: vê financeiro e aprova orçamentos"
                    sx={{
                      ...finCampoSx,
                      '& .MuiOutlinedInput-root': { height: 'auto', minHeight: 64 },
                      '& .MuiInputBase-input': { height: 'auto', py: 1 },
                    }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={form.ativo}
                        onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                      />
                    }
                    label={<Typography sx={{ fontSize: 13 }}>Perfil ativo</Typography>}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={form.aprovador}
                        onChange={(e) => setForm((f) => ({ ...f, aprovador: e.target.checked }))}
                      />
                    }
                    label={<Typography sx={{ fontSize: 13 }}>Pode aprovar orçamentos</Typography>}
                  />
                </Stack>
              </Secao>

              <Secao titulo="Telas e menus">
                <Typography sx={{ fontSize: 12, color: FIN_MUTED, mb: 1.25 }}>
                  Marque o que quem tem este perfil vê no menu e pode usar. Sem marcar, a aba some.
                </Typography>
                <Stack spacing={1.5}>
                  {MENUS_SISTEMA.map((grupo) => {
                    const disponiveis = grupo.codigos.filter((c) => mapaNome.has(c) || catalogo.some((p) => p.codigo === c));
                    if (!disponiveis.length) return null;
                    const todas = disponiveis.every((c) => form.permissoes.includes(c));
                    const algumas = !todas && disponiveis.some((c) => form.permissoes.includes(c));
                    return (
                      <Box
                        key={grupo.titulo}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          border: `1px solid ${FIN_BORDER}`,
                          bgcolor: FIN_SURFACE_ALT,
                        }}
                      >
                        <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                          <Checkbox
                            size="small"
                            checked={todas}
                            indeterminate={algumas}
                            onChange={(e) => marcarGrupo(disponiveis, e.target.checked)}
                            sx={{ p: 0.25, mt: 0.1 }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: FIN_TEXT }}>
                              {grupo.titulo}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: FIN_MUTED }}>{grupo.descricao}</Typography>
                          </Box>
                        </Stack>
                        <FormGroup sx={{ pl: 3.5 }}>
                          {disponiveis.map((codigo) => (
                            <FormControlLabel
                              key={codigo}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={form.permissoes.includes(codigo)}
                                  onChange={() => togglePerm(codigo)}
                                />
                              }
                              label={
                                <Typography sx={{ fontSize: 12.5, lineHeight: 1.35 }}>
                                  {mapaNome.get(codigo) || codigo}
                                </Typography>
                              }
                              sx={{ m: 0, alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.1 } }}
                            />
                          ))}
                        </FormGroup>
                      </Box>
                    );
                  })}

                  {outrosCodigos.length > 0 ? (
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        border: `1px solid ${FIN_BORDER}`,
                        bgcolor: FIN_SURFACE_ALT,
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>Outras ações</Typography>
                      <FormGroup>
                        {outrosCodigos.map((p) => (
                          <FormControlLabel
                            key={p.codigo}
                            control={
                              <Checkbox
                                size="small"
                                checked={form.permissoes.includes(p.codigo)}
                                onChange={() => togglePerm(p.codigo)}
                              />
                            }
                            label={
                              <Typography sx={{ fontSize: 12.5 }}>
                                {p.nome}
                                <Typography component="span" sx={{ color: FIN_MUTED, fontSize: 11 }}>
                                  {' '}
                                  · {p.grupo}
                                </Typography>
                              </Typography>
                            }
                            sx={{ m: 0 }}
                          />
                        ))}
                      </FormGroup>
                    </Box>
                  ) : null}
                </Stack>
              </Secao>

              {tiposCatalogo.length > 0 ? (
                <Secao titulo="Checklists AutoREV">
                  <Typography sx={{ fontSize: 12, color: FIN_MUTED, mb: 1 }}>
                    Quais checklists este perfil pode executar no app.
                  </Typography>
                  <FormGroup>
                    {tiposCatalogo.map((t) => (
                      <FormControlLabel
                        key={t.codigo}
                        control={
                          <Checkbox
                            size="small"
                            checked={form.tipos_checklist.includes(t.codigo)}
                            onChange={() =>
                              setForm((f) => ({
                                ...f,
                                tipos_checklist: f.tipos_checklist.includes(t.codigo)
                                  ? f.tipos_checklist.filter((c) => c !== t.codigo)
                                  : [...f.tipos_checklist, t.codigo],
                              }))
                            }
                          />
                        }
                        label={<Typography sx={{ fontSize: 13 }}>{t.nome}</Typography>}
                        sx={{ m: 0 }}
                      />
                    ))}
                  </FormGroup>
                </Secao>
              ) : null}
        </PainelLateral>
        </Stack>
      </Box>
    </PrefsProvider>
  );
}
