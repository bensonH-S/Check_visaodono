/** Dados da empresa e texto do termo de compromisso de ferramentas. */

export const EMPRESA_TERMO = {
  razaoSocial: 'ALVIM INVESTIMENTOS E PARTICIPAÇÕES S.A',
  cnpj: '45.376.937/0001-02',
  ie: '08.117.499/001-01',
  endereco: 'SCRN Quadra 706/707 Bloco E Loja 32',
  nomeFantasia: 'GRUPO ALVIM',
};

export const TERMO_FERRAMENTAS_VERSAO = '1.0';

export function textoTermoFerramentas(nomeColaborador) {
  const e = EMPRESA_TERMO;
  return `TERMO DE COMPROMISSO E RESPONSABILIDADE — FERRAMENTAS E EQUIPAMENTOS

${e.razaoSocial}, inscrita no CNPJ ${e.cnpj}, Inscrição Estadual ${e.ie}, com sede em ${e.endereco}, doravante "${e.nomeFantasia}", e o(a) colaborador(a) ${nomeColaborador}, doravante "RESPONSÁVEL", firmam o presente termo:

1. O RESPONSÁVEL recebe em comodato as ferramentas e equipamentos listados/fotografados neste registro, para uso exclusivo nas atividades profissionais.

2. O RESPONSÁVEL declara estar ciente de que é integralmente responsável pela guarda, conservação e uso adequado dos bens recebidos.

3. Em caso de perda, furto, dano por mau uso, negligência ou não devolução, o RESPONSÁVEL autoriza o desconto do valor de reposição ou reparo diretamente no repasse/remuneração, conforme apuração e normas internas da empresa.

4. O RESPONSÁVEL compromete-se a devolver os bens em perfeito estado de conservação (salvo desgaste natural) quando solicitado ou ao término do vínculo.

5. Este termo possui validade enquanto perdurar a posse dos equipamentos e pode ser atualizado mediante nova versão assinada digitalmente.

Ao assinar digitalmente, o RESPONSÁVEL declara ter lido, compreendido e concordado integralmente com os termos acima.`;
}
