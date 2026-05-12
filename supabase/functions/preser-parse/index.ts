import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const form = await req.formData();
    const file = form.get("pdf") as File | null;
    if (!file) return json({ error: "PDF não enviado" }, 400);
    if (file.size > 12_000_000) return json({ error: "PDF maior que 12MB" }, 400);

    const pdfBytes = await file.arrayBuffer();
    const pdfB64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfB64 },
            },
            { type: "text", text: "Extraia todos os dados deste extrato PRESER e retorne o JSON conforme as instruções." },
          ],
        },
      ],
    });

    const raw = (msg.content[0] as { type: string; text: string }).text;
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) return json({ error: "Claude não retornou JSON", raw }, 500);

    const parsed = JSON.parse(jsonMatch[1]);
    return json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Você é um extrator de dados especializado em extratos PRESER da Nestlé do Brasil.
Extraia TODOS os dados do PDF e retorne EXCLUSIVAMENTE um JSON válido entre \`\`\`json e \`\`\`, sem nenhum texto fora do bloco.

## Conversões obrigatórias
- Números brasileiros (1.234.567,89) → float (1234567.89)
- Percentuais (2,500%) → decimal float (0.025)
- Percentuais de atingimento como "0,397%" → 0.00397
- periodo: extraia Ano/Mês do cabeçalho e retorne "YYYY-MM-01"
- grupo_codigo: apenas o número antes do primeiro " - " (ex: "4 - Linha seca - NESCAU LATA 200G" → 4)
- divisao: primeira parte após o código ("Linha seca", "Garoto", "Professional")
- grupo_nome: tudo após o segundo " - "

## Estrutura JSON a retornar

\`\`\`json
{
  "extrato": {
    "periodo": "YYYY-MM-01",
    "broker": "35 BROK MB",
    "planta": "2858",
    "regional": "NE",
    "valor_total_comissao": 0.0,
    "valor_total_contabilizado": 0.0,
    "faturamento_ac": 0.0,
    "irrf_retido": 0.0,
    "pis_retido": 0.0,
    "cofins_retido": 0.0,
    "csll_retido": 0.0
  },
  "skus": [
    {
      "grupo_codigo": 4,
      "grupo_nome": "NESCAU LATA 200G",
      "divisao": "Linha seca",
      "categoria": 1,
      "categoria_nome": "Mix Pilar",
      "efetivo": 97212.29,
      "efetivo_adicional": 0.0,
      "efetivo_total": 97212.29,
      "pct_comissao": 0.025,
      "comissao": 2430.307
    }
  ],
  "drops": [
    {
      "canal_codigo": 1,
      "canal_nome": "Trad Outros",
      "qtd_drops": 1995,
      "rs_por_drop": 57.31,
      "fator_regionalizacao": 0.86,
      "fator_deslocamento": 1.09,
      "rs_calculado": 53.722,
      "comissao": 107176.176
    }
  ],
  "metas": [
    {
      "criterio_codigo": 2,
      "criterio_nome": "Recomendador de Pedidos - Exceto NPRO e Canais 11 e 14",
      "bu": "BRL1",
      "tipo": "Recomendador",
      "objetivo_minimo": null,
      "objetivo_meta": 0.5,
      "objetivo_ideal": null,
      "pct_minimo": null,
      "pct_meta": 0.0055,
      "pct_ideal": null,
      "efetivo_fiscal": 0.43293,
      "efetivo_mes": 14585831.79,
      "pct_atingido": 0.0055,
      "comissao": 80222.07
    },
    {
      "criterio_codigo": 3,
      "criterio_nome": "VBC Total - Linha Seca",
      "bu": "BRL1",
      "tipo": "VBC",
      "objetivo_minimo": 11354057.1,
      "objetivo_meta": 13865796.776,
      "objetivo_ideal": 15252376.453,
      "pct_minimo": 0.0035,
      "pct_meta": 0.005,
      "pct_ideal": 0.0065,
      "efetivo_fiscal": 12147729.16,
      "efetivo_mes": 13327728.22,
      "pct_atingido": 0.00397,
      "comissao": 52911.081
    }
  ],
  "outros": [
    {
      "criterio_codigo": 21,
      "criterio_nome": "Garantia de crédito - NiM",
      "tipo_servico": "Garantia de Crédito",
      "bu": null,
      "base_calculo": 16802353.42,
      "base_unidade": "%",
      "rs_unitario": 0.006,
      "comissao": 100814.12,
      "observacao": null,
      "contabilizado": true
    },
    {
      "criterio_codigo": 24,
      "criterio_nome": "Prestação de Serviço Variável Entrega - NiM (Cte)",
      "tipo_servico": "Prestação Fixa",
      "bu": null,
      "base_calculo": 525048.443,
      "base_unidade": "kg",
      "rs_unitario": 0.5,
      "comissao": 262524.22,
      "observacao": "SOMENTE DEMONSTRATIVO",
      "contabilizado": false
    }
  ]
}
\`\`\`

## Regras específicas por seção

### extrato
- valor_total_comissao: campo "Valor de comissão Total" (página 7)
- valor_total_contabilizado: "Valor total contabilizado" (página 8)
- faturamento_ac: use o Efetivo Mês do Critério 21 (Garantia de crédito — campo "Efetivo Mês (R$)")
- irrf_retido: SOMA de todos os IRRF retidos da seção Contabilização (Representação Comercial + Garantia de Crédito)
- pis_retido: SOMA de todos os PIS retidos
- cofins_retido: SOMA de todos os COFINS retidos
- csll_retido: SOMA de todos os CSLL retidos

### skus (Critério 1 — Representação Comercial Variável - NiM)
- Extraia TODAS as linhas de produto (Linha seca, Garoto, Professional)
- NÃO inclua linha de subtotal
- categoria: 1=Mix Pilar, 2=High Pull, 3=High High Pull, 4=Estratégico
- Inclua valores negativos (ex: KIT KAT MINI MOMENTS: efetivo_total=-40.25, comissao=-1.61)

### drops (Critério 20 — Remuneração Comercial Drops - NiM)
- Extraia todos os 12 canais
- canal_codigo: número do canal (1=Trad Outros, 2=Trad Bronze, 3=AS Regular, 4=AS Prata, 5=AS Ouro, 6=Distribuidor, 7=KA Distribuidor, 8=KA, 9=KA Top, 10=Farma C, 11=Farma B, 15=Especializado Professional)

### metas
Inclua estas critérios na tabela metas:

**Recomendadores** (tipo="Recomendador"):
- Critério 2 (BRL1), 67 (Farma), 70 (BRN2), 71 (BRN8), 72 (Purina)
- efetivo_fiscal = o percentual "Resultado Recomendador" como decimal (ex: 43.293% → 0.43293)
- objetivo_meta = 0.5 (limiar de 50% para pagamento)
- pct_atingido = % Atingimento do PDF como decimal
- efetivo_mes = VBC Efetivo do PDF

**VBC** (tipo="VBC"):
- Critérios 3 (Linha Seca/BRL1), 5 (Garoto/BRL1), 11 (Professional Food/BRN2), 62 (Professional Bebidas/BRN8), 14 (Farma), 60 (Purina Alimentar), 61 (Purina Especializado)
- objetivo_minimo/meta/ideal: da seção "Informações Adicionais" (páginas 9-13)
- pct_minimo=0.0035, pct_meta=0.005, pct_ideal=0.0065 (padrão)
- efetivo_fiscal: do resumo (páginas 4-5)
- pct_atingido: % Atingido como decimal

**Cobertura** (tipo="Cobertura"):
- Critérios 4 (Linha Seca), 6 (Garoto), 12 (Professional Food), 63 (Professional Bebidas), 59 (Purina Alimentar), 9 (Purina Especializado)
- Para cobertura, efetivo_fiscal e objetivo_* são contagens de clientes (números inteiros)

**Aderência Roteiro** (tipo="VBC" como proxy):
- Critério 15 (Farma): sem objetivos explícitos, capture apenas comissao

### outros
Inclua tudo que NÃO for SKU, drop ou meta:
- Critério 65 (Merchandising): comissao=157437.67, tipo_servico="Representação Comercial"
- Critério 17 (Visitas Farma): comissao=2466.74, tipo_servico="Representação Comercial"
- Critério 19 (Visitas PAC): comissao=20291.58, tipo_servico="Representação Comercial"
- Critério 21 (Garantia crédito): tipo_servico="Garantia de Crédito", base_calculo=efetivo_mes, rs_unitario=0.006
- Critério 98 (RC-DC seguro): tipo_servico="Prestação Fixa"
- Critério 101 (RC-DC T2): tipo_servico="Prestação Fixa"
- Critério 22 (Armazenagem): tipo_servico="Prestação Fixa", base_calculo=total_pallets, base_unidade="pallets"
- Critério 23 (Refrigerado): tipo_servico="Prestação Fixa", base_calculo=56, base_unidade="pallets"
- Critério 24 (Entrega CTE): contabilizado=false, observacao="SOMENTE DEMONSTRATIVO"
- Critério 25 (Operação Logística): tipo_servico="Prestação Fixa"
- Critério 26, 32, 33, 66, 96, 102, 108, 35 (Outros): use observacao para a descrição textual presente no PDF
  - Critério 26: observacao="Ressarcimento da contração dos impulsionadores de Páscoa 2026"
  - Critério 32: observacao="Bonus de incentivo Mar + Rec Bimestral", bu="BRN2"
  - Critério 33: observacao="Bonus de incentivo Mar + Rec Bimestral", bu="BRN8"
  - Critério 66: observacao="Ressarcimento da diferença do R$/KG de Páscoa 2026"
  - Critério 96: observacao="2858 - SPCEFBRO5258 - NESTLÉ", comissao=-3042.54
  - Critério 102: observacao="2858 - SPCEFBRO5258 - NESTLÉ", comissao=-22.39
  - Critério 108: observacao="7ª Parcela - Seguro Patrimonial TI"
  - Critério 35: observacao="Visita BMB Máquinas Bebidas (BR Mania mar 2026)", bu="BRN8"

Retorne APENAS o JSON, sem texto fora do bloco \`\`\`json...\`\`\`.`;
