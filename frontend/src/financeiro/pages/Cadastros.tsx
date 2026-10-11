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
  BotaoEditar, Secao, Selo, TabelaConfig, textoRemocao, Titulo, useBusca, type Coluna, type Situacao, type Traduzir,
} from '../components/ConfigUi'
import { usePrefs } from '../prefs'

export const POR_PAGINA = 30

const BANCOS = { itau: 'Itaú', banco_do_brasil: 'Banco do Brasil' } as const

function Documento({ valor }: { valor: string | null | undefined }) {
  return <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cnpjFormatado(valor)}</Box>
}

function Uso({ n, singular, plural }: { n: number; singular: string; plural: string }) {
  return <Typography sx={{ fontSize: 13, color: n ? 'text.primary' : 'text.secondary' }}>{n} {n === 1 ? singular : plural}</Typography>
}

function Ativo({ ativo }: { ativo: boolean }) {
  const { t } = usePrefs()
  return <Selo texto={ativo ? t('Ativo', 'Active') : t('Inativo', 'Inactive')} tom={ativo ? 'ok' : 'neutro'} />
}

function Chave({ ligado, onMudar, texto }: { ligado: boolean; onMudar: (v: boolean) => void; texto: string }) {
  return (
    <FormControlLabel
      control={<Switch checked={ligado} onChange={(ev) => onMudar(ev.target.checked)} />}
      label={<Typography sx={{ fontSize: 13 }}>{texto}</Typography>}
    />
  )
}

function useFormulario<T extends Record<string, unknown>>(
  tipo: TipoCadastro,
  id: string | null,
  inicial: T,
  nome: (f: T) => string,
  onSalvo: (texto: string) => void,
  t: Traduzir,
) {
  const [form, setForm] = useState<T>(inicial)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const campo = <K extends keyof T>(chave: K) => (valor: T[K]) => setForm((atual) => ({ ...atual, [chave]: valor }))

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      await api.salvarCadastro(tipo, id, form)
      const n = nome(form)
      onSalvo(id ? t(`“${n}” atualizado.`, `“${n}” updated.`) : t(`“${n}” cadastrado.`, `“${n}” created.`))
    } catch (err) {
      setErro(mensagem(err, t('Não salvou', 'Could not save')))
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!id) return
    setSalvando(true)
    try {
      onSalvo(textoRemocao(nome(form), await api.removerCadastro(tipo, id), t))
    } catch (err) {
      setErro(mensagem(err, t('Não excluiu', 'Could not delete')))
      setSalvando(false)
    }
  }

  return { form, setForm, campo, erro, salvando, salvar, excluir }
}

const textoEmpresa = (e: EmpresaCompleta) => `${e.apelido || ''} ${e.razao_social} ${e.cnpj || ''} ${e.bk_number || ''}`

export function Empresas() {
  const { t } = usePrefs()
  const [empresas, setEmpresas] = useState<EmpresaCompleta[]>([])
  const [situacao, setSituacao] = useState<Situacao>('ativos')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<EmpresaCompleta | 'nova' | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => api.empresasTodas().then(setEmpresas).catch((err) => setErro(mensagem(err, t('Não carregou', 'Could not load'))))
  useEffect(() => { carregar() }, [])

  const naSituacao = useMemo(() => porSituacao(empresas, situacao, (e) => e.ativo), [empresas, situacao])
  const { busca, setBusca, filtradas } = useBusca(naSituacao, textoEmpresa)
  useEffect(() => { setPagina(0) }, [busca, situacao])

  const ativas = empresas.filter((e) => e.ativo)
  const lojas = ativas.filter((e) => e.tipo === 'loja').length

  const colunas: Coluna<EmpresaCompleta>[] = [
    { titulo: t('Empresa', 'Company'), render: (e) => <Titulo texto={e.apelido || e.razao_social} sub={e.razao_social} /> },
    { titulo: 'CNPJ', render: (e) => <Documento valor={e.cnpj} /> },
    { titulo: 'BK', render: (e) => e.bk_number || '—' },
    { titulo: t('Tipo', 'Type'), render: (e) => <Selo texto={e.tipo === 'loja' ? t('Loja', 'Store') : 'Holding'} tom={e.tipo === 'loja' ? 'neutro' : 'info'} /> },
    { titulo: t('Situação', 'Status'), render: (e) => <Ativo ativo={e.ativo} /> },
    { titulo: ' ', align: 'right', largura: 48, render: (e) => <BotaoEditar onClick={() => setEditando(e)} /> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo={t('Empresas ativas', 'Active companies')} valor={String(ativas.length)} detalhe={t('no cadastro do Finance', 'in the Finance registry')} />
        <Resumo rotulo={t('Lojas', 'Stores')} valor={String(lojas)} detalhe={t('operação BK', 'BK operations')} />
        <Resumo rotulo="Holdings" valor={String(ativas.length - lojas)} detalhe={t('administrativo', 'administrative')} />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder={t('Buscar empresa, CNPJ ou BK', 'Search company, CNPJ or BK')}>
        <FiltroSituacao valor={situacao} onMudar={setSituacao} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('nova')}>{t('Nova empresa', 'New company')}</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)}
        chave={(e) => e.id}
        vazio={t('Nenhuma empresa encontrada.', 'No company found.')}
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
  const { t } = usePrefs()
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
    t,
  )

  return (
    <PainelLateral
      aberto
      titulo={empresa ? empresa.apelido || empresa.razao_social : t('Nova empresa', 'New company')}
      subtitulo={empresa
        ? t(`${empresa.uso} registros ligados a esta empresa`, `${empresa.uso} records linked to this company`)
        : t('Loja ou holding do grupo', 'Group store or holding')}
      onFechar={onFechar}
      rodape={<AcoesForm existe={!!empresa} emUso={!!empresa?.uso} salvando={salvando} podeSalvar={!!form.razao_social.trim()} onSalvar={salvar} onExcluir={excluir} onFechar={onFechar} />}
    >
      <Secao titulo={t('Identificação', 'Identification')}>
        <TextField label={t('Apelido', 'Nickname')} size="small" value={form.apelido} onChange={(ev) => campo('apelido')(ev.target.value)} helperText={t('Nome curto usado nas telas.', 'Short name used on screens.')} autoFocus={!empresa} />
        <TextField label={t('Razão social', 'Legal name')} size="small" required value={form.razao_social} onChange={(ev) => campo('razao_social')(ev.target.value)} />
        <TextField label="CNPJ" size="small" value={form.cnpj} onChange={(ev) => campo('cnpj')(ev.target.value)} />
        <TextField select label={t('Tipo', 'Type')} size="small" value={form.tipo} onChange={(ev) => campo('tipo')(ev.target.value as EmpresaCompleta['tipo'])}>
          <MenuItem value="loja">{t('Loja', 'Store')}</MenuItem>
          <MenuItem value="holding">Holding</MenuItem>
        </TextField>
        <TextField label={t('Número BK', 'BK number')} size="small" value={form.bk_number} onChange={(ev) => campo('bk_number')(ev.target.value)} helperText={t('Liga a loja às vendas do BK Office.', 'Links the store to BK Office sales.')} />
        <TextField label={t('Inscrição estadual', 'State tax ID')} size="small" value={form.inscricao_estadual} onChange={(ev) => campo('inscricao_estadual')(ev.target.value)} />
      </Secao>
      <Secao titulo={t('Endereço', 'Address')}>
        <TextField label={t('Endereço', 'Address')} size="small" value={form.endereco} onChange={(ev) => campo('endereco')(ev.target.value)} />
        <Stack direction="row" spacing={1.5}>
          <TextField label={t('Cidade', 'City')} size="small" value={form.cidade} onChange={(ev) => campo('cidade')(ev.target.value)} sx={{ flex: 2 }} />
          <TextField label="CEP" size="small" value={form.cep} onChange={(ev) => campo('cep')(ev.target.value)} sx={{ flex: 1 }} />
        </Stack>
      </Secao>
      <Chave ligado={form.ativo} onMudar={campo('ativo')} texto={t('Empresa ativa', 'Company active')} />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}

const textoConta = (c: ContaCompleta) => `${c.nome || ''} ${c.apelido} ${c.agencia || ''} ${c.numero || ''} ${c.banco ? BANCOS[c.banco] : ''}`

function dadosConta(c: ContaCompleta, t: Traduzir) {
  if (c.tipo === 'dinheiro') return '—'
  return `${t('Ag.', 'Br.')} ${c.agencia || '—'} · ${t('C/C', 'Acct')} ${c.numero || '—'}${c.digito ? `-${c.digito}` : ''}`
}

export function Contas() {
  const { t } = usePrefs()
  const [contas, setContas] = useState<ContaCompleta[]>([])
  const [empresas, setEmpresas] = useState<EmpresaCompleta[]>([])
  const [situacao, setSituacao] = useState<Situacao>('ativos')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<ContaCompleta | 'nova' | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => api.contasTodas().then(setContas).catch((err) => setErro(mensagem(err, t('Não carregou', 'Could not load'))))
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
    { titulo: t('Conta', 'Account'), render: (c) => <Titulo texto={c.nome || '—'} sub={c.apelido} /> },
    {
      titulo: t('Tipo', 'Type'),
      render: (c) => <Selo texto={c.tipo === 'dinheiro' ? t('Conta dinheiro', 'Cash account') : t('Conta corrente', 'Checking account')} tom={c.tipo === 'dinheiro' ? 'neutro' : 'info'} />,
    },
    { titulo: t('Banco', 'Bank'), render: (c) => (c.banco ? BANCOS[c.banco] : '—') },
    {
      titulo: t('Agência e conta', 'Branch and account'),
      render: (c) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{dadosConta(c, t)}</Box>,
    },
    { titulo: t('Situação', 'Status'), render: (c) => <Ativo ativo={c.ativa} /> },
    { titulo: ' ', align: 'right', largura: 48, render: (c) => <BotaoEditar onClick={() => setEditando(c)} /> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo={t('Contas ativas', 'Active accounts')} valor={String(ativas.length)} detalhe={t('em todas as empresas', 'across all companies')} />
        <Resumo rotulo={t('Contas correntes', 'Checking accounts')} valor={String(ativas.length - dinheiro)} detalhe="Banco do Brasil e Itaú" />
        <Resumo rotulo={t('Contas dinheiro', 'Cash accounts')} valor={String(dinheiro)} detalhe={t('caixa das lojas', 'store cash')} />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder={t('Buscar conta, empresa ou agência', 'Search account, company or branch')}>
        <FiltroSituacao valor={situacao} onMudar={setSituacao} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('nova')}>{t('Nova conta', 'New account')}</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)}
        chave={(c) => c.id}
        vazio={t('Nenhuma conta encontrada.', 'No account found.')}
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
  const { t } = usePrefs()
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
    t,
  )
  const corrente = form.tipo === 'corrente'
  const completo = !!form.empresa_id && !!form.nome.trim() && (!corrente || (!!form.agencia.trim() && !!form.numero.trim()))

  return (
    <PainelLateral
      aberto
      titulo={conta ? conta.nome || t('Conta', 'Account') : t('Nova conta', 'New account')}
      subtitulo={conta
        ? t(`${conta.apelido} · ${conta.uso} despesas saem desta conta`, `${conta.apelido} · ${conta.uso} expenses leave this account`)
        : t('Conta de onde o dinheiro sai', 'Account money leaves from')}
      onFechar={onFechar}
      rodape={<AcoesForm existe={!!conta} emUso={!!conta?.uso} salvando={salvando} podeSalvar={completo} onSalvar={salvar} onExcluir={excluir} onFechar={onFechar} />}
    >
      <Secao titulo={t('Conta', 'Account')}>
        <TextField select label={t('Empresa', 'Company')} size="small" required value={form.empresa_id} onChange={(ev) => campo('empresa_id')(ev.target.value)}>
          {empresas.map((e) => <MenuItem key={e.id} value={e.id}>{e.apelido || e.razao_social}</MenuItem>)}
        </TextField>
        <TextField label={t('Nome', 'Name')} size="small" required value={form.nome} onChange={(ev) => campo('nome')(ev.target.value)} helperText={t('Como aparece no lançamento.', 'How it appears on the entry.')} />
        <TextField select label={t('Tipo', 'Type')} size="small" value={form.tipo} onChange={(ev) => campo('tipo')(ev.target.value as ContaCompleta['tipo'])}>
          <MenuItem value="corrente">{t('Conta corrente', 'Checking account')}</MenuItem>
          <MenuItem value="dinheiro">{t('Conta dinheiro', 'Cash account')}</MenuItem>
        </TextField>
      </Secao>
      {corrente ? (
        <Secao titulo={t('Dados bancários', 'Bank details')}>
          <TextField select label={t('Banco', 'Bank')} size="small" value={form.banco} onChange={(ev) => campo('banco')(ev.target.value as 'itau' | 'banco_do_brasil')}>
            <MenuItem value="itau">Itaú</MenuItem>
            <MenuItem value="banco_do_brasil">Banco do Brasil</MenuItem>
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField label={t('Agência', 'Branch')} size="small" required value={form.agencia} onChange={(ev) => campo('agencia')(ev.target.value)} sx={{ flex: 1 }} />
            <TextField label={t('Conta', 'Account')} size="small" required value={form.numero} onChange={(ev) => campo('numero')(ev.target.value)} sx={{ flex: 1.4 }} />
            <TextField label={t('Dígito', 'Digit')} size="small" value={form.digito} onChange={(ev) => campo('digito')(ev.target.value)} sx={{ width: 80 }} />
          </Stack>
        </Secao>
      ) : null}
      <Chave ligado={form.ativa} onMudar={campo('ativa')} texto={t('Conta ativa', 'Account active')} />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}

export function Fornecedores() {
  const { t, idioma } = usePrefs()
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
    const timer = setTimeout(() => {
      api.listaFornecedores(busca.trim(), pagina, POR_PAGINA, situacao).then(setDados).catch((err) => setErro(mensagem(err, t('Não carregou', 'Could not load'))))
    }, busca ? 250 : 0)
    return () => clearTimeout(timer)
  }, [busca, pagina, situacao, versao])

  const colunas: Coluna<FornecedorCompleto>[] = [
    { titulo: t('Fornecedor', 'Supplier'), render: (f) => <Titulo texto={f.nome} sub={f.razao_social && f.razao_social !== f.nome ? f.razao_social : undefined} /> },
    { titulo: 'CPF/CNPJ', render: (f) => <Documento valor={f.cpf_cnpj} /> },
    { titulo: t('Plano padrão', 'Default account'), render: (f) => (f.plano ? f.plano : <Selo texto={t('Sem plano', 'No account')} tom="alerta" />) },
    {
      titulo: t('Uso', 'Usage'),
      render: (f) => <Uso n={f.uso} singular={t('lançamento', 'entry')} plural={t('lançamentos', 'entries')} />,
    },
    { titulo: t('Situação', 'Status'), render: (f) => <Ativo ativo={f.ativo} /> },
    { titulo: ' ', align: 'right', largura: 48, render: (f) => <BotaoEditar onClick={() => setEditando(f)} /> },
  ]

  const detalheTotal = busca.trim()
    ? t('na busca atual', 'in the current search')
    : situacao === 'ativos'
      ? t('ativos no cadastro', 'active in the registry')
      : situacao === 'inativos'
        ? t('inativos', 'inactive')
        : t('no cadastro', 'in the registry')

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo
          rotulo={busca.trim() ? t('Encontrados', 'Found') : t('Fornecedores', 'Suppliers')}
          valor={dados.total.toLocaleString(idioma === 'en' ? 'en-US' : 'pt-BR')}
          detalhe={detalheTotal}
        />
        <Resumo
          rotulo={t('Com plano padrão', 'With default account')}
          valor={dados.com_plano.toLocaleString(idioma === 'en' ? 'en-US' : 'pt-BR')}
          detalhe={t('classificam sozinhos', 'classify automatically')}
        />
        <Resumo
          rotulo={t('Sem plano padrão', 'Without default account')}
          valor={(dados.total - dados.com_plano).toLocaleString(idioma === 'en' ? 'en-US' : 'pt-BR')}
          detalhe={t('pedem classificação manual', 'need manual classification')}
        />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder={t('Buscar fornecedor ou CNPJ', 'Search supplier or CNPJ')}>
        <FiltroSituacao valor={situacao} onMudar={setSituacao} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('novo')}>{t('Novo fornecedor', 'New supplier')}</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={dados.linhas}
        chave={(f) => f.id}
        vazio={t('Nenhum fornecedor encontrado.', 'No supplier found.')}
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
  const { t } = usePrefs()
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
    t,
  )
  const planoAtual = fornecedor?.plano_conta_id && !planos.some((p) => p.id === fornecedor.plano_conta_id)
    ? [{ id: fornecedor.plano_conta_id, nome: t(`${fornecedor.plano} (inativo)`, `${fornecedor.plano} (inactive)`) }]
    : []

  return (
    <PainelLateral
      aberto
      titulo={fornecedor ? fornecedor.nome : t('Novo fornecedor', 'New supplier')}
      subtitulo={fornecedor
        ? t(`${fornecedor.uso} lançamentos ligados a este fornecedor`, `${fornecedor.uso} entries linked to this supplier`)
        : t('Cadastro financeiro', 'Financial registry')}
      onFechar={onFechar}
      rodape={<AcoesForm existe={!!fornecedor} emUso={!!fornecedor?.uso} salvando={salvando} podeSalvar={!!form.nome.trim()} onSalvar={salvar} onExcluir={excluir} onFechar={onFechar} />}
    >
      <Secao titulo={t('Identificação', 'Identification')}>
        <TextField label={t('Nome', 'Name')} size="small" required value={form.nome} onChange={(ev) => campo('nome')(ev.target.value)} autoFocus={!fornecedor} />
        <TextField label={t('Razão social', 'Legal name')} size="small" value={form.razao_social} onChange={(ev) => campo('razao_social')(ev.target.value)} />
        <TextField label={t('CPF ou CNPJ', 'CPF or CNPJ')} size="small" value={form.cpf_cnpj} onChange={(ev) => campo('cpf_cnpj')(ev.target.value)} helperText={t('Usado para ligar o boleto do DDA ao fornecedor.', 'Used to match the DDA boleto to the supplier.')} />
      </Secao>
      <Secao titulo={t('Classificação', 'Classification')}>
        <TextField select label={t('Plano padrão', 'Default account')} size="small" value={form.plano_conta_id} onChange={(ev) => campo('plano_conta_id')(ev.target.value)} helperText={t('Aplicado sozinho quando chega um boleto deste fornecedor.', 'Applied automatically when a boleto from this supplier arrives.')}>
          <MenuItem value="">{t('Sem plano padrão', 'No default account')}</MenuItem>
          {[...planoAtual, ...planos].map((p) => <MenuItem key={p.id} value={p.id}>{p.nome}</MenuItem>)}
        </TextField>
      </Secao>
      <Secao titulo={t('Endereço', 'Address')}>
        <Stack direction="row" spacing={1.5}>
          <TextField label={t('Logradouro', 'Street')} size="small" value={form.logradouro} onChange={(ev) => campo('logradouro')(ev.target.value)} sx={{ flex: 3 }} />
          <TextField label={t('Número', 'Number')} size="small" value={form.numero} onChange={(ev) => campo('numero')(ev.target.value)} sx={{ flex: 1 }} />
        </Stack>
        <TextField label={t('Bairro', 'District')} size="small" value={form.bairro} onChange={(ev) => campo('bairro')(ev.target.value)} />
        <Stack direction="row" spacing={1.5}>
          <TextField label={t('Cidade', 'City')} size="small" value={form.cidade} onChange={(ev) => campo('cidade')(ev.target.value)} sx={{ flex: 2 }} />
          <TextField label="UF" size="small" value={form.estado} onChange={(ev) => campo('estado')(ev.target.value.toUpperCase().slice(0, 2))} sx={{ width: 72 }} />
          <TextField label="CEP" size="small" value={form.cep} onChange={(ev) => campo('cep')(ev.target.value)} sx={{ flex: 1 }} />
        </Stack>
      </Secao>
      <Chave ligado={form.ativo} onMudar={campo('ativo')} texto={t('Fornecedor ativo', 'Supplier active')} />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
