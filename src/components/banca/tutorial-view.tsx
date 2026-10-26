'use client'

import { useState, useEffect } from 'react'
import {
  BookOpen,
  ShoppingCart,
  Package,
  ReceiptText,
  FileSpreadsheet,
  LockKeyhole,
  Database,
  Store,
  Users,
  Smartphone,
  CloudOff,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

interface Section {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  body: React.ReactNode
}

/** Novidades da versão atual: atualizar este bloco a cada lançamento */
const NOVIDADES: { version: string; items: string[] }[] = [
  {
    version: '1.2.0',
    items: [
      'Backup completo nas Definições: descarrega tudo (vendas, produtos, stock, fechos, contas) e restaura quando precisar.',
      'Recibos novos: partilhar, enviar por WhatsApp, imprimir em papel pequeno (80 mm) e guardar em PDF.',
      'Dados da banca em todos os recibos e exportações: nome, NUIT, contacto e endereço (configurar nas Definições).',
      'Relatórios em PDF prontos a imprimir ou enviar ao contador.',
      'Lucro por categoria nos Relatórios: veja o que dá mais dinheiro.',
      'Exportar produtos e stock em CSV a partir de Produtos.',
      'Contacto do patrão e NUIT nas Definições.',
      'Esta página de Ajuda, com o guia sempre atualizado.',
    ],
  },
  {
    version: '1.1.2',
    items: [
      'Editar o nome de qualquer utilizador (Funcionários, botão Editar).',
      'Exportar vendas em CSV nos Relatórios.',
      'Partilhar recibo da venda.',
    ],
  },
]

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-muted-foreground">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

export default function TutorialView() {
  const [openId, setOpenId] = useState<string | null>('novidades')

  // marca o tutorial como visto nesta versão (apaga a bolinha "novo" no menu)
  useEffect(() => {
    try {
      localStorage.setItem('mb-ajuda-visto', APP_VERSION)
    } catch {
      /* sem localStorage */
    }
  }, [])

  const sections: Section[] = [
    {
      id: 'vender',
      title: 'Vender (PDV)',
      icon: ShoppingCart,
      body: (
        <Ul
          items={[
            'Abra "Vender" no menu e toque nos produtos para os juntar à venda. Use a busca ou as categorias no topo para achar rápido.',
            'No carrinho, ajuste as quantidades com + e -, ou remova um artigo com o lixo.',
            'Escolha o pagamento: Dinheiro, M-Pesa, e-Mola, Cartão/POS ou Outro. Em dinheiro pode digitar o valor recebido e o sistema mostra o troco.',
            '"Finalizar venda" baixa o stock sozinho e mostra o recibo, com botões de WhatsApp, Imprimir e PDF.',
            'Sem internet? Não pare: a venda fica guardada no aparelho e sincroniza sozinha quando a rede voltar.',
          ]}
        />
      ),
    },
    {
      id: 'recibos',
      title: 'Recibos: WhatsApp, impressão e PDF',
      icon: ReceiptText,
      body: (
        <Ul
          items={[
            'No recibo de cada venda (e ao abrir uma venda no histórico) há 4 botões: Partilhar, WhatsApp, Imprimir e Guardar PDF.',
            '"WhatsApp do patrão": se o contacto estiver nas Definições, o recibo segue direto para esse número; senão escolhe o contacto na hora.',
            '"Imprimir" prepara o recibo em papel pequeno (bobina de 80 mm), igual às máquinas de recibo.',
            '"Guardar PDF" cria um recibo em PDF de 80 mm para enviar ou arquivar.',
            'Todos os recibos levam os dados da banca (nome, NUIT, contacto, endereço e mensagem final) que se configuram nas Definições, cartão "Dados da banca".',
          ]}
        />
      ),
    },
    {
      id: 'produtos',
      title: 'Produtos e stock',
      icon: Package,
      body: (
        <Ul
          items={[
            'Crie produtos em "Produtos" > "Novo produto": nome, categoria, unidade, preço de custo e de venda, stock e mínimo.',
            'A categoria serve para organizar o PDV e agora também mostra o lucro por categoria nos Relatórios.',
            'Em "Stock" registe entradas (compras ao grossista), perdas e ajustes: tudo fica no histórico.',
            'Quando um produto chega ao mínimo, o painel avisa: altura de comprar mais.',
            'Para levar a lista ao grossista, use "Exportar CSV" em Produtos: sai em Excel com custos, preços e stock.',
          ]}
        />
      ),
    },
    {
      id: 'exportar',
      title: 'Exportar: CSV e PDF',
      icon: FileSpreadsheet,
      body: (
        <Ul
          items={[
            'Nos Relatórios: "Exportar CSV" abre as vendas no Excel (uma linha por artigo, com pagamento e atendente) e "Exportar PDF" cria um relatório completo para imprimir ou enviar.',
            'O PDF do relatório leva o resumo, vendas por dia, pagamentos, lucro por categoria e produtos mais vendidos, com os dados da banca no cabeçalho.',
            'Os CSV saem prontos para Excel português (separador ; e vírgula decimal).',
          ]}
        />
      ),
    },
    {
      id: 'fechos',
      title: 'Fecho do dia',
      icon: LockKeyhole,
      body: (
        <Ul
          items={[
            'No fim do dia abra "Fechos": digite quanto dinheiro há na gaveta.',
            'O sistema compara com o esperado (fundo de caixa + vendas em dinheiro) e mostra a diferença.',
            'Guarde o fecho para ficar com o registo do dia, incluindo totais por forma de pagamento.',
          ]}
        />
      ),
    },
    {
      id: 'backup',
      title: 'Backup: guardar e restaurar',
      icon: Database,
      body: (
        <Ul
          items={[
            'Nas Definições, cartão "Backup e restauro": "Descarregar backup" guarda TUDO num ficheiro .json.',
            'Guarde o ficheiro num lugar seguro: envie para o seu WhatsApp, e-mail, Google Drive ou pen USB.',
            '"Restaurar de ficheiro" põe tudo de volta (substitui os dados atuais). Peça ajuda ao técnico se tiver dúvidas.',
            'Recomendação: backup uma vez por semana e sempre antes de atualizar o sistema.',
          ]}
        />
      ),
    },
    {
      id: 'definicoes',
      title: 'Dados da banca e definições',
      icon: Store,
      body: (
        <Ul
          items={[
            'Nas Definições pode mudar o nome da banca, moeda, fundo de caixa, contacto/WhatsApp do patrão, NUIT, endereço e a mensagem do rodapé dos recibos.',
            'Estes dados saem em todos os recibos, PDFs e exportações: mantenha-os atualizados.',
          ]}
        />
      ),
    },
    {
      id: 'contas',
      title: 'Contas e PINs',
      icon: Users,
      body: (
        <Ul
          items={[
            'Em "Funcionários" (patrão) crie contas e use o botão "Editar" para mudar o nome ou o PIN de cada pessoa.',
            'O Funcionário vê só o essencial: vender, produtos e stock; não vê lucros nem relatórios.',
            'O PIN do técnico (IT) é só para manutenção do sistema.',
          ]}
        />
      ),
    },
    {
      id: 'atualizar',
      title: 'Atualizar a aplicação',
      icon: Smartphone,
      body: (
        <Ul
          items={[
            'Quando houver versão nova, aparece um aviso no topo da app (para todas as contas). Toque em "Descarregar" e instale o APK que desce.',
            'Também pode verificar manualmente em Definições > "Aplicação e atualizações".',
            'Instalar por cima não apaga nada. Mesmo assim, faça um backup antes: nunca se sabe.',
          ]}
        />
      ),
    },
    {
      id: 'offline',
      title: 'Modo sem internet',
      icon: CloudOff,
      body: (
        <Ul
          items={[
            'A app continua a vender sem internet: os produtos ficam guardados no aparelho.',
            'As vendas feitas offline entram numa fila e sobem sozinhas quando a rede volta.',
            'O aviso laranja no topo mostra quando está neste modo.',
          ]}
        />
      ),
    },
  ]

  return (
    <div className="space-y-4 md:space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Ajuda e tutorial
        </h1>
        <p className="text-sm text-muted-foreground">
          O guia da banca, atualizado a cada nova versão (agora v{APP_VERSION}).
        </p>
      </div>

      {/* Novidades por versão */}
      <Card className="border-primary/40">
        <button
          className="w-full text-left"
          onClick={() => setOpenId(openId === 'novidades' ? '' : 'novidades')}
          aria-expanded={openId === 'novidades'}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Novidades da versão v{APP_VERSION}
              <ChevronDown
                className={cn(
                  'ml-auto h-4 w-4 transition-transform',
                  openId === 'novidades' && 'rotate-180',
                )}
              />
            </CardTitle>
          </CardHeader>
        </button>
        {openId === 'novidades' && (
          <CardContent className="space-y-4">
            {NOVIDADES.map((n) => (
              <div key={n.version} className="space-y-2">
                <Badge variant="secondary" className="font-mono">
                  v{n.version}
                </Badge>
                <Ul items={n.items} />
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* Secções do guia */}
      <div className="space-y-2.5">
        {sections.map((s) => {
          const open = openId === s.id
          return (
            <Card key={s.id}>
              <button
                className="w-full text-left"
                onClick={() => setOpenId(open ? '' : s.id)}
                aria-expanded={open}
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm md:text-base flex items-center gap-2 font-medium">
                    <s.icon className="h-4 w-4 text-primary shrink-0" />
                    {s.title}
                    <ChevronDown
                      className={cn('ml-auto h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
                    />
                  </CardTitle>
                </CardHeader>
              </button>
              {open && <CardContent className="pt-1 pb-4">{s.body}</CardContent>}
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Dúvidas ou sugestões? Fale com o técnico do sistema: tudo o que pedir entra na próxima
        atualização.
      </p>
    </div>
  )
}
