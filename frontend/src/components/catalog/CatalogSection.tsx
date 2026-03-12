import { useState } from "react";
import { Plus, Pencil, PowerOff, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HasId {
  id: number;
  is_active: boolean;
}

interface CatalogSectionProps<T extends HasId> {
  title: string;
  items: T[];
  isLoading?: boolean;
  renderRow: (item: T) => React.ReactNode;
  headers: string[];
  renderForm: (item: T | null, onClose: () => void) => React.ReactNode;
  onToggleActive: (id: number) => void;
  formTitle?: string;
}

export default function CatalogSection<T extends HasId>({
  title,
  items,
  isLoading,
  renderRow,
  headers,
  renderForm,
  onToggleActive,
  formTitle,
}: CatalogSectionProps<T>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button size="sm" variant="outline" onClick={openAdd} className="h-7 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" />
          新增
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-muted-foreground px-4 py-3">載入中…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-3">尚無資料</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {headers.map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">
                    {h}
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs w-24">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b last:border-0 transition-colors",
                    !item.is_active && "bg-muted/20 text-muted-foreground"
                  )}
                >
                  {renderRow(item)}
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!item.is_active && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 mr-1 text-muted-foreground">
                          停用
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => openEdit(item)}
                        title="編輯"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn("h-6 w-6", item.is_active ? "text-muted-foreground" : "text-emerald-600")}
                        onClick={() => onToggleActive(item.id)}
                        title={item.is_active ? "停用" : "啟用"}
                      >
                        {item.is_active ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? `編輯 ${formTitle ?? title}` : `新增 ${formTitle ?? title}`}
            </DialogTitle>
          </DialogHeader>
          {dialogOpen && renderForm(editing, closeDialog)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
