import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { api, type ContaCompleta, type EmpresaCompleta, type FornecedorCompleto, type PaginaFornecedores, type Plano, type TipoCadastro } from '../api'
import {
  AcoesForm, Aviso, Barra, cnpjFormatado, Erro, FiltroSituacao, mensagem, PainelLateral, porSituacao, Resumo, Resumos,
  Secao, Selo, TabelaConfig, textoRemocao, Titulo, useBusca, type Coluna, type Situacao,
} from '../components/ConfigUi'

export const POR_PAGINA = 30

const BANCOS = { itau: 'Itaú', banco_do_brasil: 'Banco do Brasil' } as const

function Documento({ valor }: { valor: string | null | undefined }) {
  return <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cnpjFormatado(valor)}</Box>
}

function Uso({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return <Typography sx={{ fontSize: 13, color: n ? 'text.primary' : 'text.secondary' }}>{n} {n === 1 ? singular : plural}</Typography>
}

function Ativo({ ativo }: { ativo: boolean }) {
  return <Selo texto={ativo ? 'Ativo' : 'Inativo'} tom={ativo ? 'ok' : 'neutro'} />
}

function Chave({ ligado, onMudar, texto }: { ligado: boolean; onMudar: (v: boolean) => void; texto: string }) {
  return (
    <FormControlLabel
      control={<Switch checked={ligado} onChange={(ev) => onMudar(ev.target.checked)} />}
      label={<Typography sx={{ fontSize: 13 }}>{texto}</Typography>}
    />
  )
}

function useFormulario<T extends Record<string, unknown>>(tipo: TipoCadastro, id: string | null, inicial: T, nome: (f: T) => string, onSalvo: (texto: string) => void) {
  const [form, setForm] = useState<T>(inicial)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const campo = <K extends keyof T>(chave: K) => (valor: T[K]) => setForm((atual) => ({ ...atual, [chave]: valor }))

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      await api.salvarCadastro(tipo, id, form)
      onSalvo(id ? `“${nome(form)}” atualizado.` : `“${nome(form)}” cadastrado.`)
    } catch (err) {
      setErro(mensagem(err, 'Não salvou'))
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!id) return
    setSalvando(true)
    try {
      onSalvo(textoRemocao(nome(form), await api.removerCadastro(tipo, id)))
    } catch (err) {
      setErro(mensagem(err, 'Não excluiu'))
      setSalvando(false)
    }
  }

  return { form, setForm, campo, erro, salvando, salvar, excluir }
}

const textoEmpresa = (e: EmpresaCompleta) => `${e.apelido || ''} ${e.razao_social} ${e.cnpj || ''} ${e.bk_number || ''}`

export function Empresas() {
  const [empresas, setEmpresas] = useState<EmpresaCompleta[]>([])
  const [situacao, setSituacao] = useState<Situacao>('ativos')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<EmpresaCompleta | 'nova' | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => api.empresasTodas().then(setEmpresas).catch((err) => setErro(mensagem(err)))
  useEffect(() => { carregar() }, [])

  const naSituacao = useMemo(() => porSituacao(empresas, situacao, (e) => e.ativo), [empresas, situacao])
  const { busca, setBusca, filtradas } = useBusca(naSituacao, textoEmpresa)
  useEffect(() => { setPagina(0) }, [busca, situacao])

  const ativas = empresas.filter((e) => e.ativo)
  const lojas = ativas.filter((e) => e.tipo === 'loja').length

  const colunas: Coluna<EmpresaCompleta>[] = [
    { titulo: 'Empresa', render: (e) => <Titulo texto={e.apelido || e.razao_social} sub={e.razao_social} /> },
    { titulo: 'CNPJ', render: (e) => <Documento valor={e.cnpj} /> },
    { titulo: 'BK', render: (e) => e.bk_number || '—' },
    { titulo: 'Tipo', render: (e) => <Selo texto={e.tipo === 'loja' ? 'Loja' : 'Holding'} tom={e.tipo === 'loja' ? 'neutro' : 'info'} /> },
    { titulo: 'Situação', render: (e) => <Ativo ativo={e.ativo} /> },
    { titulo: ' ', align: 'right', render: (e) => <Button size="small" onClick={(ev) => { ev.stopPropagation(); setEditando(e) }}>Editar</Button> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo="Empresas ativas" valor={String(ativas.length)} detalhe="no cadastro do Finance" />
        <Resumo rotulo="Lojas" valor={String(lojas)} detalhe="operação BK" />
        <Resumo rotulo="Holdings" valor={String(ativas.length - lojas)} detalhe="administrativo" />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder="Buscar empresa, CNPJ ou BK">
        <FiltroSituacao valor={situacao} onMudar={setSituacao} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('nova')}>Nova empresa</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)}
        chave={(e) => e.id}
        vazio="Nenhuma empresa encontrada."
        onLinha={setEditando}
        paginacao={{ total: filtradas.length, pagina, por: POR_PAGINA, onPagina: setPagina }}
      />
      {editando ? (
        <FormEmpresa
          key={editando === 'nova' ? 'nova' : editando.id}
          empresa={editando === 'nova' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={(texto) => { setEditando(null); setAviso(texto); carregar() }}
        />
      ) : null}
      <Aviso texto={aviso} onFechar={() => setAviso('')} />
    </Stack>
  )
}

function FormEmpresa({ empresa, onFechar, onSalvo }: { empresa: EmpresaCompleta | null; onFechar: () => void; onSalvo: (texto: string) => void }) {
  const { form, campo, erro, salvando, salvar, excluir } = useFormulario(
    'empresas',
    empresa?.id || null,
    {
      apelido: empresa?.apelido || '',
      razao_social: empresa?.razao_social || '',
      cnpj: cnpjFormatado(empresa?.cnpj) === '—' ? '' : cnpjFormatado(empresa?.cnpj),
      bk_number: empresa?.bk_number || '',
      inscricao_estadual: empresa?.inscricao_estadual || '',
      endereco: empresa?.endereco || '',
      cidade: empresa?.cidade || '',
      cep: empresa?.cep || '',
      tipo: empresa?.tipo || 'loja',
      ativo: empresa ? empresa.ativo : true,
    },
    (f) => f.apelido || f.razao_social,
    onSalvo,
  )

  return (
    <PainelLateral
      aberto
      titulo={empresa ? empresa.apelido || empresa.razao_social : 'Nova empresa'}
      subtitulo={empresa ? `${empresa.uso} registros ligados a esta empresa` : 'Loja ou holding do grupo'}
      onFechar={onFechar}
      rodape={<AcoesForm existe={!!empresa} emUso={!!empresa?.uso} salvando={salvando} podeSalvar={!!form.razao_social.trim()} onSalvar={salvar} onExcluir={excluir} onFechar={onFechar} />}
    >
      <Secao titulo="Identificação">
        <TextField label="Apelido" size="small" value={form.apelido} onChange={(ev) => campo('apelido')(ev.target.value)} helperText="Nome curto usado nas telas." autoFocus={!empresa} />
        <TextField label="Razão social" size="small" required value={form.razao_social} onChange={(ev) => campo('razao_social')(ev.target.value)} />
        <TextField label="CNPJ" size="small" value={form.cnpj} onChange={(ev) => campo('cnpj')(ev.target.value)} />
        <TextField select label="Tipo" size="small" value={form.tipo} onChange={(ev) => campo('tipo')(ev.target.value as EmpresaCompleta['tipo'])}>
          <MenuItem value="loja">Loja</MenuItem>
          <MenuItem value="holding">Holding</MenuItem>
        </TextField>
        <TextField label="Número BK" size="small" value={form.bk_number} onChange={(ev) => campo('bk_number')(ev.target.value)} helperText="Liga a loja às vendas do BK Office." />
        <TextField label="Inscrição estadual" size="small" value={form.inscricao_estadual} onChange={(ev) => campo('inscricao_estadual')(ev.target.value)} />
      </Secao>
      <Secao titulo="Endereço">
        <TextField label="Endereço" size="small" value={form.endereco} onChange={(ev) => campo('endereco')(ev.target.value)} />
        <Stack direction="row" spacing={1.5}>
          <TextField label="Cidade" size="small" value={form.cidade} onChange={(ev) => campo('cidade')(ev.target.value)} sx={{ flex: 2 }} />
          <TextField label="CEP" size="small" value={form.cep} onChange={(ev) => campo('cep')(ev.target.value)} sx={{ flex: 1 }} />
        </Stack>
      </Secao>
      <Chave ligado={form.ativo} onMudar={campo('ativo')} texto="Empresa ativa" />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}

const textoConta = (c: ContaCompleta) => `${c.nome || ''} ${c.apelido} ${c.agencia || ''} ${c.numero || ''} ${c.banco ? BANCOS[c.banco] : ''}`

function dadosConta(c: ContaCompleta) {
  if (c.tipo === 'dinheiro') return '—'
  return `Ag. ${c.agencia || '—'} · C/C ${c.numero || '—'}${c.digito ? `-${c.digito}` : ''}`
}

export function Contas() {
  const [contas, setContas] = useState<ContaCompleta[]>([])
  const [empresas, setEmpresas] = useState<EmpresaCompleta[]>([])
  const [situacao, setSituacao] = useState<Situacao>('ativos')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<ContaCompleta | 'nova' | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => api.contasTodas().then(setContas).catch((err) => setErro(mensagem(err)))
  useEffect(() => {
    carregar()
    api.empresasTodas().then(setEmpresas).catch(() => undefined)
  }, [])

  const naSituacao = useMemo(() => porSituacao(contas, situacao, (c) => c.ativa), [contas, situacao])
  const { busca, setBusca, filtradas } = useBusca(naSituacao, textoConta)
  useEffect(() => { setPagina(0) }, [busca, situacao])

  const ativas = contas.filter((c) => c.ativa)
  const dinheiro = ativas.filter((c) => c.tipo === 'dinheiro').length

  const colunas: Coluna<ContaCompleta>[] = [
    { titulo: 'Conta', render: (c) => <Titulo texto={c.nome || '—'} sub={c.apelido} /> },
    { titulo: 'Tipo', render: (c) => <Selo texto={c.tipo === 'dinheiro' ? 'Conta dinheiro' : 'Conta corrente'} tom={c.tipo === 'dinheiro' ? 'neutro' : 'info'} /> },
    { titulo: 'Banco', render: (c) => (c.banco ? BANCOS[c.banco] : '—') },
    { titulo: 'Agência e conta', render: (c) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{dadosConta(c)}</Box> },
    { titulo: 'Situação', render: (c) => <Ativo ativo={c.ativa} /> },
    { titulo: ' ', align: 'right', render: (c) => <Button size="small" onClick={(ev) => { ev.stopPropagation(); setEditando(c) }}>Editar</Button> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo="Contas ativas" valor={String(ativas.length)} detalhe="em todas as empresas" />
        <Resumo rotulo="Contas correntes" valor={String(ativas.length - dinheiro)} detalhe="Banco do Brasil e Itaú" />
        <Resumo rotulo="Contas dinheiro" valor={String(dinheiro)} detalhe="caixa das lojas" />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder="Buscar conta, empresa ou agência">
        <FiltroSituacao valor={situacao} onMudar={setSituacao} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('nova')}>Nova conta</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)}
        chave={(c) => c.id}
        vazio="Nenhuma conta encontrada."
        onLinha={setEditando}
        paginacao={{ total: filtradas.length, pagina, por: POR_PAGINA, onPagina: setPagina }}
      />
      {editando ? (
        <FormConta
          key={editando === 'nova' ? 'nova' : editando.id}
          conta={editando === 'nova' ? null : editando}
          empresas={empresas.filter((e) => e.ativo || (editando !== 'nova' && e.id === editando.empresa_id))}
          onFechar={() => setEditando(null)}
          onSalvo={(texto) => { setEditando(null); setAviso(texto); carregar() }}
        />
      ) : null}
      <Aviso texto={aviso} onFechar={() => setAviso('')} />
    </Stack>
  )
}

function FormConta({ conta, empresas, onFechar, onSalvo }: { conta: ContaCompleta | null; empresas: EmpresaCompleta[]; onFechar: () => void; onSalvo: (texto: string) => void }) {
  const { form, campo, erro, salvando, salvar, excluir } = useFormulario(
    'contas',
    conta?.id || null,
    {
      empresa_id: conta?.empresa_id || '',
      nome: conta?.nome || '',
      tipo: conta?.tipo || 'corrente',
      banco: conta?.banco || 'itau',
      agencia: conta?.agencia || '',
      numero: conta?.numero || '',
      digito: conta?.digito || '',
      ativa: conta ? conta.ativa : true,
    },
    (f) => f.nome,
    onSalvo,
  )
  const corrente = form.tipo === 'corrente'
  const completo = !!form.empresa_id && !!form.nome.trim() && (!corrente || (!!form.agencia.trim() && !!form.numero.trim()))

  return (
    <PainelLateral
      aberto
      titulo={conta ? conta.nome || 'Conta' : 'Nova conta'}
      subtitulo={conta ? `${conta.apelido} · ${conta.uso} despesas saem desta conta` : 'Conta de onde o dinheiro sai'}
      onFechar={onFechar}
      rodape={<AcoesForm existe={!!conta} emUso={!!conta?.uso} salvando={salvando} podeSalvar={completo} onSalvar={salvar} onExcluir={excluir} onFechar={onFechar} />}
    >
      <Secao titulo="Conta">
        <TextField select label="Empresa" size="small" required value={form.empresa_id} onChange={(ev) => campo('empresa_id')(ev.target.value)}>
          {empresas.map((e) => <MenuItem key={e.id} value={e.id}>{e.apelido || e.razao_social}</MenuItem>)}
        </TextField>
        <TextField label="Nome" size="small" required value={form.nome} onChange={(ev) => campo('nome')(ev.target.value)} helperText="Como aparece no lançamento." />
        <TextField select label="Tipo" size="small" value={form.tipo} onChange={(ev) => campo('tipo')(ev.target.value as ContaCompleta['tipo'])}>
          <MenuItem value="corrente">Conta corrente</MenuItem>
          <MenuItem value="dinheiro">Conta dinheiro</MenuItem>
        </TextField>
      </Secao>
      {corrente ? (
        <Secao titulo="Dados bancários">
          <TextField select label="Banco" size="small" value={form.banco} onChange={(ev) => campo('banco')(ev.target.value as 'itau' | 'banco_do_brasil')}>
            <MenuItem value="itau">Itaú</MenuItem>
            <MenuItem value="banco_do_brasil">Banco do Brasil</MenuItem>
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField label="Agência" size="small" required value={form.agencia} onChange={(ev) => campo('agencia')(ev.target.value)} sx={{ flex: 1 }} />
            <TextField label="Conta" size="small" required value={form.numero} onChange={(ev) => campo('numero')(ev.target.value)} sx={{ flex: 1.4 }} />
            <TextField label="Dígito" size="small" value={form.digito} onChange={(ev) => campo('digito')(ev.target.value)} sx={{ width: 80 }} />
          </Stack>
        </Secao>
      ) : null}
      <Chave ligado={form.ativa} onMudar={campo('ativa')} texto="Conta ativa" />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}

export function Fornecedores() {
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('ativos')
  const [pagina, setPagina] = useState(0)
  const [dados, setDados] = useState<PaginaFornecedores>({ total: 0, com_plano: 0, linhas: [] })
  const [planos, setPlanos] = useState<Plano[]>([])
  const [editando, setEditando] = useState<FornecedorCompleto | 'novo' | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => { api.plano().then(setPlanos).catch(() => undefined) }, [])
  useEffect(() => { setPagina(0) }, [busca, situacao])

  useEffect(() => {
    const t = setTimeout(() => {
      api.listaFornecedores(busca.trim(), pagina, POR_PAGINA, situacao).then(setDados).catch((err) => setErro(mensagem(err)))
    }, busca ? 250 : 0)
    return () => clearTimeout(t)
  }, [busca, pagina, situacao, versao])

  const colunas: Coluna<FornecedorCompleto>[] = [
    { titulo: 'Fornecedor', render: (f) => <Titulo texto={f.nome} sub={f.razao_social && f.razao_social !== f.nome ? f.razao_social : undefined} /> },
    { titulo: 'CPF/CNPJ', render: (f) => <Documento valor={f.cpf_cnpj} /> },
    { titulo: 'Plano padrão', render: (f) => (f.plano ? f.plano : <Selo texto="Sem plano" tom="alerta" />) },
    { titulo: 'Uso', render: (f) => <Uso n={f.uso} singular="lançamento" plural="lançamentos" /> },
    { titulo: 'Situação', render: (f) => <Ativo ativo={f.ativo} /> },
    { titulo: ' ', align: 'right', render: (f) => <Button size="small" onClick={(ev) => { ev.stopPropagation(); setEditando(f) }}>Editar</Button> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo={busca.trim() ? 'Encontrados' : 'Fornecedores'} valor={dados.total.toLocaleString('pt-BR')} detalhe={busca.trim() ? 'na busca atual' : situacao === 'ativos' ? 'ativos no cadastro' : situacao === 'inativos' ? 'inativos' : 'no cadastro'} />
        <Resumo rotulo="Com plano padrão" valor={dados.com_plano.toLocaleString('pt-BR')} detalhe="classificam sozinhos" />
        <Resumo rotulo="Sem plano padrão" valor={(dados.total - dados.com_plano).toLocaleString('pt-BR')} detalhe="pedem classificação manual" />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder="Buscar fornecedor ou CNPJ">
        <FiltroSituacao valor={situacao} onMudar={setSituacao} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('novo')}>Novo fornecedor</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={dados.linhas}
        chave={(f) => f.id}
        vazio="Nenhum fornecedor encontrado."
        onLinha={setEditando}
        paginacao={{ total: dados.total, pagina, por: POR_PAGINA, onPagina: setPagina }}
      />
      {editando ? (
        <FormFornecedor
          key={editando === 'novo' ? 'novo' : editando.id}
          fornecedor={editando === 'novo' ? null : editando}
          planos={planos}
          onFechar={() => setEditando(null)}
          onSalvo={(texto) => { setEditando(null); setAviso(texto); setVersao((v) => v + 1) }}
        />
      ) : null}
      <Aviso texto={aviso} onFechar={() => setAviso('')} />
    </Stack>
  )
}

function FormFornecedor({ fornecedor, planos, onFechar, onSalvo }: { fornecedor: FornecedorCompleto | null; planos: Plano[]; onFechar: () => void; onSalvo: (texto: string) => void }) {
  const { form, campo, erro, salvando, salvar, excluir } = useFormulario(
    'fornecedores',
    fornecedor?.id || null,
    {
      nome: fornecedor?.nome || '',
      razao_social: fornecedor?.razao_social || '',
      cpf_cnpj: fornecedor?.cpf_cnpj ? cnpjFormatado(fornecedor.cpf_cnpj) : '',
      plano_conta_id: fornecedor?.plano_conta_id || '',
      logradouro: fornecedor?.logradouro || '',
      numero: fornecedor?.numero || '',
      bairro: fornecedor?.bairro || '',
      cidade: fornecedor?.cidade || '',
      estado: fornecedor?.estado || '',
      cep: fornecedor?.cep || '',
      ativo: fornecedor ? fornecedor.ativo : true,
    },
    (f) => f.nome,
    onSalvo,
  )
  const planoAtual = fornecedor?.plano_conta_id && !planos.some((p) => p.id === fornecedor.plano_conta_id)
    ? [{ id: fornecedor.plano_conta_id, nome: `${fornecedor.plano} (inativo)` }]
    : []

  return (
    <PainelLateral
      aberto
      titulo={fornecedor ? fornecedor.nome : 'Novo fornecedor'}
      subtitulo={fornecedor ? `${fornecedor.uso} lançamentos ligados a este fornecedor` : 'Cadastro financeiro'}
      onFechar={onFechar}
      rodape={<AcoesForm existe={!!fornecedor} emUso={!!fornecedor?.uso} salvando={salvando} podeSalvar={!!form.nome.trim()} onSalvar={salvar} onExcluir={excluir} onFechar={onFechar} />}
    >
      <Secao titulo="Identificação">
        <TextField label="Nome" size="small" required value={form.nome} onChange={(ev) => campo('nome')(ev.target.value)} autoFocus={!fornecedor} />
        <TextField label="Razão social" size="small" value={form.razao_social} onChange={(ev) => campo('razao_social')(ev.target.value)} />
        <TextField label="CPF ou CNPJ" size="small" value={form.cpf_cnpj} onChange={(ev) => campo('cpf_cnpj')(ev.target.value)} helperText="Usado para ligar o boleto do DDA ao fornecedor." />
      </Secao>
      <Secao titulo="Classificação">
        <TextField select label="Plano padrão" size="small" value={form.plano_conta_id} onChange={(ev) => campo('plano_conta_id')(ev.target.value)} helperText="Aplicado sozinho quando chega um boleto deste fornecedor.">
          <MenuItem value="">Sem plano padrão</MenuItem>
          {[...planoAtual, ...planos].map((p) => <MenuItem key={p.id} value={p.id}>{p.nome}</MenuItem>)}
        </TextField>
      </Secao>
      <Secao titulo="Endereço">
        <Stack direction="row" spacing={1.5}>
          <TextField label="Logradouro" size="small" value={form.logradouro} onChange={(ev) => campo('logradouro')(ev.target.value)} sx={{ flex: 3 }} />
          <TextField label="Número" size="small" value={form.numero} onChange={(ev) => campo('numero')(ev.target.value)} sx={{ flex: 1 }} />
        </Stack>
        <TextField label="Bairro" size="small" value={form.bairro} onChange={(ev) => campo('bairro')(ev.target.value)} />
        <Stack direction="row" spacing={1.5}>
          <TextField label="Cidade" size="small" value={form.cidade} onChange={(ev) => campo('cidade')(ev.target.value)} sx={{ flex: 2 }} />
          <TextField label="UF" size="small" value={form.estado} onChange={(ev) => campo('estado')(ev.target.value.toUpperCase().slice(0, 2))} sx={{ width: 72 }} />
          <TextField label="CEP" size="small" value={form.cep} onChange={(ev) => campo('cep')(ev.target.value)} sx={{ flex: 1 }} />
        </Stack>
      </Secao>
      <Chave ligado={form.ativo} onMudar={campo('ativo')} texto="Fornecedor ativo" />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
