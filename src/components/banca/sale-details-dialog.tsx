'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Ban, CheckCircle2, Share2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api-client'
import { openExternal } from '@/lib/version'
import type { Sale, Settings } from '@/lib/types'
import { formatMoney, formatDateTime, paymentLabel } from '@/lib/format'

export default function SaleDetailsDialog({
  saleId,
  open,
  onClose,
  isPatrao,
  currency,
}: {
  saleId: number | null
  open: boolean
  onClose: () => void
  isPatrao: boolean
  currency: string
}) {
  const qc = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ settings: Settings }>('/api/settings'),
    staleTime: Infinity,
  })
  const businessName = settingsQuery.data?.settings.businessName ?? 'Mac Banca'

  const saleQuery = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => api<{ sale: Sale }>(`/api/sales/${saleId}`),
    enabled: open && saleId !== null,
  })

  const voidMutation = useMutation({
    mutationFn: (id: number) =>
      api(`/api/sales/${id}`, { method: 'PATCH', json: { action: 'anular' } }),
    onSuccess: () => {
      toast.success(`Venda #${saleId} anulada. Stock reposto.`)
      qc.invalidateQueries({ queryKey: ['sale', saleId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['movements'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao anular'),
  })

  const sale = saleQuery.data?.sale

  // Recibo em texto para partilhar (nativo ou WhatsApp)
  const shareText = sale
    ? [
        businessName,
        `Venda #${sale.id} : ${formatDateTime(sale.createdAt)}`,
        ...(sale.items ?? []).map((it) => `${it.qty}x ${it.name} = ${formatMoney(it.subtotal, currency)}`),
        `Total: ${formatMoney(sale.total, currency)} (${paymentLabel(sale.payment)})`,
        `Atendeu: ${sale.user.name}`,
      ].join('\n')
    : ''

  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text: shareText })
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
    openExternal(`https://wa.me/?text=${encodeURIComponent(shareText)}`)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Venda #{saleId}
            {sale?.status === 'ANULADA' && <Badge variant="destructive">Anulada</Badge>}
          </DialogTitle>
          <DialogDescription>
            {sale ? formatDateTime(sale.createdAt) : 'A carregar...'}
          </DialogDescription>
        </DialogHeader>

        {sale ? (
          <div className="space-y-3">
            <div className="rounded-lg border divide-y">
              {sale.items?.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex-1 min-w-0 truncate">
                    {it.name}
                    <span className="text-muted-foreground"> × {it.qty}</span>
                  </span>
                  <span className="font-medium">{formatMoney(it.subtotal, currency)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Forma de pagamento</span>
                <span>{paymentLabel(sale.payment)}</span>
              </div>
              {sale.received != null && sale.payment === 'DINHEIRO' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recebido</span>
                    <span>{formatMoney(sale.received, currency)}</span>
                  </div>
                  {(sale.change ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Troco</span>
                      <span className="font-medium">{formatMoney(sale.change ?? 0, currency)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{formatMoney(sale.total, currency)}</span>
              </div>
              {isPatrao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lucro</span>
                  <span className="text-primary font-semibold">
                    {formatMoney(sale.profit ?? 0, currency)}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Atendido por {sale.user.name}</span>
              {sale.status === 'CONCLUIDA' && (
                <span className="flex items-center gap-1 text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Concluída
                </span>
              )}
            </div>

            {sale.status === 'CONCLUIDA' && (
              <Button variant="outline" className="w-full" onClick={() => share()}>
                <Share2 className="h-4 w-4" />
                Partilhar recibo
              </Button>
            )}

            {isPatrao && sale.status === 'CONCLUIDA' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Ban className="h-4 w-4" />
                    Anular venda e repor stock
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Anular a venda #{sale.id}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O valor de {formatMoney(sale.total, currency)} sai dos totais do dia e as
                      quantidades voltam para o stock. Esta ação não pode ser revertida.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Manter venda</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => voidMutation.mutate(sale.id)}
                    >
                      Sim, anular
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">A carregar venda...</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
