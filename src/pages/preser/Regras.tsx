import { BookOpen, Layers, Truck, Target, Receipt, Shield, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";

export default function PreserRegras() {
  return (
    <>
      <PageHeader
        title="Regras do PRESER"
        subtitle="Como funciona o cálculo da remuneração do broker Nestlé"
      />

      {/* ── Introdução ─────────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            O que é o PRESER
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <p>
            <strong>PRESER</strong> = <strong>Prêmio de Serviço e Resultado</strong>. É o sistema de
            remuneração que a Nestlé do Brasil paga aos seus brokers (distribuidores) — no nosso caso,
            a <strong>MB Logística (Broker 35 BROK MB · Planta 2858 · Regional NE)</strong>.
          </p>
          <p>
            O extrato mensal é dividido em <strong>11 grupos de critérios</strong> que somam a
            comissão total bruta. Esses critérios cobrem desde a representação comercial (porcentagem
            sobre vendas) até prestação de serviços fixos (armazenagem, seguro, entrega).
          </p>
          <p className="text-muted-foreground">
            <strong>Período de apuração:</strong> mensal, do dia 20 ao dia 19 do mês seguinte (ex:
            extrato de Apuração 2026/4 = atividade entre 20/Mar e 19/Abr).
          </p>
        </CardContent>
      </Card>

      {/* ── 1. Representação Comercial Variável (SKUs) ─────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            1. Representação Comercial Variável — SKUs (Critério 1)
          </CardTitle>
          <CardDescription>
            Comissão proporcional ao volume vendido de cada produto, dividida por categoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Cada produto (SKU) é classificado em uma das <strong>4 categorias</strong> com alíquotas
            distintas:
          </p>
          <Table>
            <THead>
              <Tr>
                <Th>Categoria</Th>
                <Th className="text-right">% Comissão</Th>
                <Th>Quando usar</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td>
                  <Badge style={{ background: "hsl(215 80% 48% / 0.2)", color: "hsl(215 80% 48%)", border: "none" }}>
                    1 · Mix Pilar
                  </Badge>
                </Td>
                <Td className="text-right font-mono font-bold">2,500%</Td>
                <Td className="text-sm text-muted-foreground">
                  Produtos do mix base — alta penetração e volume.
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Badge style={{ background: "hsl(38 92% 50% / 0.2)", color: "hsl(38 92% 50%)", border: "none" }}>
                    2 · High Pull
                  </Badge>
                </Td>
                <Td className="text-right font-mono font-bold">1,150%</Td>
                <Td className="text-sm text-muted-foreground">
                  Produtos consolidados com alta demanda — alíquota reduzida.
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Badge style={{ background: "hsl(271 60% 56% / 0.2)", color: "hsl(271 60% 56%)", border: "none" }}>
                    3 · High High Pull
                  </Badge>
                </Td>
                <Td className="text-right font-mono font-bold">0,250%</Td>
                <Td className="text-sm text-muted-foreground">
                  Produtos premium com forte tração — alíquota mínima.
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Badge style={{ background: "hsl(152 60% 42% / 0.2)", color: "hsl(152 60% 42%)", border: "none" }}>
                    4 · Estratégico
                  </Badge>
                </Td>
                <Td className="text-right font-mono font-bold">4,000%</Td>
                <Td className="text-sm text-muted-foreground">
                  Foco estratégico Nestlé — alíquota máxima para incentivar venda.
                </Td>
              </Tr>
            </TBody>
          </Table>
          <div className="mt-3 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
            <strong>Cálculo:</strong> Comissão SKU = (Efetivo + Efetivo Adicional) × % Comissão.{" "}
            Volumes negativos (devoluções) descontam da comissão.
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Drops ────────────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            2. Remuneração por Drops — Canais (Critério 20)
          </CardTitle>
          <CardDescription>
            Pagamento por entrega física em cada canal de venda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Cada <strong>drop</strong> (entrega em um cliente) tem um valor base que depende do canal:
          </p>
          <Table>
            <THead>
              <Tr>
                <Th>Canal</Th>
                <Th className="text-right">R$/drop base</Th>
              </Tr>
            </THead>
            <TBody>
              {[
                { canal: "1 · Trad Outros", rs: "57,31" },
                { canal: "2 · Trad Bronze", rs: "68,55" },
                { canal: "3 · AS Regular / 4 · AS Prata / 6 · Distribuidor", rs: "78,77" },
                { canal: "5 · AS Ouro", rs: "137,08" },
                { canal: "7 · KA Distribuidor / 8 · KA / 9 · KA Top", rs: "259,87" },
                { canal: "10 · Farma Curva C", rs: "35,82" },
                { canal: "11 · Farma Curva B", rs: "0,00 (a confirmar)" },
                { canal: "15 · Especializado Professional", rs: "64,64" },
              ].map((c) => (
                <Tr key={c.canal}>
                  <Td>{c.canal}</Td>
                  <Td className="text-right font-mono">{c.rs}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <div className="mt-3 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
            <strong>Cálculo:</strong> R$/drop calculado = R$ base × Fator Regionalização (86% NE) ×
            Fator Deslocamento (109% padrão). Multiplicado pela quantidade de drops.
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Metas VBC + Cobertura ────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            3. Metas VBC e Cobertura — Faixas
          </CardTitle>
          <CardDescription>
            Comissão por faixa de atingimento sobre o VBC efetivo da BU.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Para cada BU (BRL1, BRN2, BRN8, Farma) há um <strong>objetivo de VBC</strong> e um
            objetivo de <strong>Cobertura de clientes</strong>. Atingindo cada faixa, paga-se um % do
            VBC efetivo do mês:
          </p>
          <Table>
            <THead>
              <Tr>
                <Th>Faixa</Th>
                <Th className="text-right">% pago sobre VBC</Th>
                <Th>Quando ativa</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td>
                  <Badge variant="muted">Mínimo</Badge>
                </Td>
                <Td className="text-right font-mono font-bold">0,350%</Td>
                <Td className="text-sm text-muted-foreground">
                  Atingiu ≥ 80% da meta (objetivo mínimo)
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Badge variant="warning">Meta</Badge>
                </Td>
                <Td className="text-right font-mono font-bold">0,500%</Td>
                <Td className="text-sm text-muted-foreground">
                  Atingiu 100% da meta (objetivo meta)
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Badge variant="success">Ideal</Badge>
                </Td>
                <Td className="text-right font-mono font-bold">0,650%</Td>
                <Td className="text-sm text-muted-foreground">
                  Atingiu ≥ 110% da meta (objetivo ideal)
                </Td>
              </Tr>
            </TBody>
          </Table>
          <div className="mt-3 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
            <strong>Critérios VBC:</strong> 3 (Linha Seca), 5 (Garoto), 11 (Pro Food), 14 (Farma), 62
            (Pro Bebidas), 76 (Nespresso).{" "}
            <br />
            <strong>Critérios Cobertura:</strong> 4, 6, 12, 63, 77 — contagem de clientes ativos no
            ciclo.
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Recomendador ─────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-warning" />
            4. Recomendador de Pedidos — Critérios 2, 67, 70, 71
          </CardTitle>
          <CardDescription>
            Percentual de pedidos feitos seguindo a recomendação automática do sistema Nestlé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            O <strong>Resultado Recomendador</strong> mede quanto da venda foi feita usando o pedido
            sugerido pelo sistema. Há um <strong>gatilho de 50%</strong>: abaixo disso, o pagamento
            depende da faixa atingida e pode zerar.
          </p>
          <Table>
            <THead>
              <Tr>
                <Th>BU</Th>
                <Th>Critério</Th>
                <Th>Foco</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr><Td>BRL1</Td><Td>2</Td><Td className="text-sm text-muted-foreground">Recomendador Geral (exceto NPRO e Canais 11/14)</Td></Tr>
              <Tr><Td>Farma</Td><Td>67</Td><Td className="text-sm text-muted-foreground">Recomendador Farma B</Td></Tr>
              <Tr><Td>BRN2</Td><Td>70</Td><Td className="text-sm text-muted-foreground">Recomendador Professional BRN2</Td></Tr>
              <Tr><Td>BRN8</Td><Td>71</Td><Td className="text-sm text-muted-foreground">Recomendador Professional BRN8</Td></Tr>
            </TBody>
          </Table>
          <div className="mt-3 rounded-lg bg-warning/10 border border-warning/30 p-3 text-xs">
            <AlertTriangle className="inline h-3 w-3 mr-1 text-warning" />
            <strong className="text-warning">Atenção:</strong> Apesar do gatilho nominal ser 50%, na
            prática a regra é mais complexa — algumas BUs pagam mesmo abaixo (BRL1 em 43,3% ainda
            pagou R$ 80k). O importante é monitorar a <strong>coluna pct_atingido</strong> do extrato:
            quando ela está em 0,00%, a comissão zera.
          </div>
        </CardContent>
      </Card>

      {/* ── 5. Outros Critérios (Garantia, Serviço Fixo, Mercha…) ─── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            5. Outros Critérios — Serviços e Bônus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <Tr>
                <Th>Crit.</Th>
                <Th>Nome</Th>
                <Th>Como funciona</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td>17 · 19 · 94</Td>
                <Td>Visitas (Farma · PAC · Bebidas)</Td>
                <Td className="text-sm text-muted-foreground">
                  R$/visita × quantidade × fatores; canais 11 (Farma B), 14 (Especializado), 15
                  (Professional).
                </Td>
              </Tr>
              <Tr>
                <Td>21</Td>
                <Td>Garantia de Crédito</Td>
                <Td className="text-sm text-muted-foreground">
                  <strong>0,6%</strong> sobre o faturamento do AC. Sujeita a impostos retidos
                  (IRRF/PIS/COFINS/CSLL).
                </Td>
              </Tr>
              <Tr>
                <Td>22</Td>
                <Td>Armazenagem (NiM)</Td>
                <Td className="text-sm text-muted-foreground">
                  R$ por pallet × quantidade × fatores. Prestação de Serviço Fixa.
                </Td>
              </Tr>
              <Tr>
                <Td>23</Td>
                <Td>Refrigerado</Td>
                <Td className="text-sm text-muted-foreground">
                  Adicional para pallets refrigerados (R$ 95,81/pallet base).
                </Td>
              </Tr>
              <Tr>
                <Td>24</Td>
                <Td>Entrega CTE</Td>
                <Td className="text-sm text-muted-foreground">
                  R$ 0,50/kg sobre peso bruto.{" "}
                  <Badge variant="muted" className="ml-1">SOMENTE DEMONSTRATIVO</Badge>
                </Td>
              </Tr>
              <Tr>
                <Td>25</Td>
                <Td>Operação Logística</Td>
                <Td className="text-sm text-muted-foreground">
                  0,591% sobre Efetivo Logístico (apenas T2/refrigerado).
                </Td>
              </Tr>
              <Tr>
                <Td>26 · 32 · 33 · 35 · 66 · 108</Td>
                <Td>Bônus pontuais</Td>
                <Td className="text-sm text-muted-foreground">
                  Ressarcimentos, bônus de incentivo, visitas especiais — valor fixo por evento.
                </Td>
              </Tr>
              <Tr>
                <Td>65</Td>
                <Td>Merchandising</Td>
                <Td className="text-sm text-muted-foreground">
                  R$/visita × coordenadores × dias trabalhados.
                </Td>
              </Tr>
              <Tr>
                <Td>98 · 101</Td>
                <Td>Seguro RC-DC</Td>
                <Td className="text-sm text-muted-foreground">
                  0,023% sobre Efetivo Mês (T1 e T2). Cobre transportador.
                </Td>
              </Tr>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── 6. Impostos ─────────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            6. Impostos Retidos na Fonte
          </CardTitle>
          <CardDescription>
            A Nestlé desconta os tributos na fonte antes de pagar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <Tr>
                <Th>Imposto</Th>
                <Th className="text-right">Alíquota</Th>
                <Th>Incide sobre</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td><strong>IRRF</strong></Td>
                <Td className="text-right font-mono">1,500%</Td>
                <Td className="text-sm text-muted-foreground">Garantia de Crédito + Prestação Variável</Td>
              </Tr>
              <Tr>
                <Td><strong>PIS</strong></Td>
                <Td className="text-right font-mono">0,650%</Td>
                <Td className="text-sm text-muted-foreground">Mesma base</Td>
              </Tr>
              <Tr>
                <Td><strong>COFINS</strong></Td>
                <Td className="text-right font-mono">3,000%</Td>
                <Td className="text-sm text-muted-foreground">Mesma base</Td>
              </Tr>
              <Tr>
                <Td><strong>CSLL</strong></Td>
                <Td className="text-right font-mono">1,000%</Td>
                <Td className="text-sm text-muted-foreground">Mesma base</Td>
              </Tr>
            </TBody>
          </Table>
          <div className="mt-3 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
            <strong>Importante:</strong> A Representação Comercial (Crit. 1, drops, metas) e
            Prestação de Serviço Fixa (Crit. 22, 23, 98, 101) ficam <strong>isentas</strong> dos
            tributos retidos — só Garantia de Crédito (Crit. 21) e Prestação Variável incidem
            tributação na fonte. Total habitual: ~5,5% sobre a parcela tributada.
          </div>
        </CardContent>
      </Card>

      {/* ── 7. Como melhorar a comissão ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4 text-success" />
            7. Como melhorar a remuneração
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Crescer SKUs Estratégicos (4%)</strong>: cada R$ 1
              vendido vira R$ 0,04 de comissão — o maior multiplicador do extrato. Ver aba{" "}
              <strong>Análise por SKU</strong>.
            </li>
            <li>
              <strong className="text-foreground">Aumentar drops em canais premium</strong>: KA Top
              paga R$ 244/drop (~4× Trad Outros). Ver aba <strong>Canais / Drops</strong>.
            </li>
            <li>
              <strong className="text-foreground">Manter Recomendador ativo</strong>: cada BU
              recebe 0,5% a 0,65% do VBC quando o Recomendador funciona. Zerar uma BU = perder ~R$
              80 mil/mês.
            </li>
            <li>
              <strong className="text-foreground">Atingir faixa Ideal nas metas VBC</strong>: subir
              de Meta (0,5%) para Ideal (0,65%) representa +30% de comissão na BU.
            </li>
            <li>
              <strong className="text-foreground">Confirmar tarifas zeradas</strong>: Farma Curva B
              veio com R$ 0/drop neste extrato — confirmar com a Nestlé pode liberar comissão
              retroativa.
            </li>
          </ul>
          <div className="mt-3 rounded-lg bg-success/10 border border-success/30 p-3 text-xs">
            💡 Use a aba <strong>Oportunidades & Perdas</strong> para ver os números exatos de cada
            gap e priorizar.
          </div>
        </CardContent>
      </Card>
    </>
  );
}
