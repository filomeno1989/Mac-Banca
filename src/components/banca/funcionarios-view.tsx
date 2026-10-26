'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserPlus, Pencil, Users as UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api-client'
import type { Role } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

interface AppUser {
  id: number
  name: string
  username: string
  role: Role
  active: boolean
  createdAt: string
  _count: { sales: number }
}

export default function FuncionariosView() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState({ name: '', pin: '' })
  const [form, setForm] = useState({ name: '', username: '', pin: '', role: 'FUNCIONARIO' })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ users: AppUser[] }>('/api/users'),
  })
  const users = usersQuery.data?.users ?? []

  const resetForm = () => setForm({ name: '', username: '', pin: '', role: 'FUNCIONARIO' })

  const addMutation = useMutation({
    mutationFn: () => api('/api/users', { method: 'POST', json: form }),
    onSuccess: () => {
      toast.success(`${form.name} criado com sucesso!`)
      setAddOpen(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['login-users'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao criar'),
  })

  const toggleMutation = useMutation({
    mutationFn: (u: AppUser) =>
      api(`/api/users/${u.id}`, { method: 'PATCH', json: { active: !u.active } }),
    onSuccess: () => {
      toast.success('Conta atualizada.')
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['login-users'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro'),
  })

  const editMutation = useMutation({
    mutationFn: () =>
      api(`/api/users/${editUser?.id}`, {
        method: 'PATCH',
        json: {
          name: editForm.name.trim(),
          ...(editForm.pin ? { pin: editForm.pin } : {}),
        },
      }),
    onSuccess: () => {
      toast.success(`Conta de ${editUser?.name} atualizada!`)
      setEditUser(null)
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['login-users'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao guardar'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-sm text-muted-foreground">
            Crie contas com PIN para quem trabalha na banca.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {users.map((u) => (
            <Card key={u.id} className={cn(!u.active && 'opacity-60')}>
              <CardContent className="flex items-center gap-3 p-4">
                <span
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    u.role === 'PATRAO' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                  )}
                >
                  {u.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <Badge
                      variant={u.role === 'PATRAO' ? 'default' : 'secondary'}
                      className="text-[11px]"
                    >
                      {ROLE_LABELS[u.role]}
                    </Badge>
                    {!u.active && <Badge variant="outline">desativada</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    @{u.username} · {u._count.sales} vendas registadas
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Switch
                    checked={u.active}
                    onCheckedChange={() => toggleMutation.mutate(u)}
                    aria-label={`Ativar/desativar conta de ${u.name}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditUser(u)
                      setEditForm({ name: u.name, pin: '' })
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog novo utilizador */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova conta</DialogTitle>
            <DialogDescription>
              A pessoa usa este nome de utilizador e PIN para entrar no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="u-name">Nome *</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Manuel"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-username">Utilizador (para entrar) *</Label>
              <Input
                id="u-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="ex.: manuel"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="u-pin">PIN (4-6 dígitos) *</Label>
                <Input
                  id="u-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                  placeholder="••••"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Cargo</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger aria-label="Cargo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                    <SelectItem value="PATRAO">Patrão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Funcionários registam vendas e veem o stock, mas não veem lucros nem preços de custo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={
                !form.name.trim() ||
                !form.username.trim() ||
                !/^\d{4,6}$/.test(form.pin) ||
                addMutation.isPending
              }
            >
              Criar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar utilizador: nome e PIN opcional */}
      <Dialog open={editUser !== null} onOpenChange={(v) => !v && setEditUser(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar {editUser?.name}</DialogTitle>
            <DialogDescription>
              O nome aparece no ecrã de entrada e nas vendas. Deixe o PIN vazio para manter o atual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Ex.: Filomeno Macuácua"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-pin">PIN novo (opcional)</Label>
              <Input
                id="edit-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={editForm.pin}
                onChange={(e) => setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, '') })}
                placeholder="manter o atual"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={
                !editForm.name.trim() ||
                (editForm.pin !== '' && !/^\d{4,6}$/.test(editForm.pin)) ||
                editMutation.isPending
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {users.length === 0 && !usersQuery.isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <UsersIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma conta criada.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
